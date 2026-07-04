type FeishuRecord = {
  record_id: string;
  fields: Record<string, unknown>;
};

type WorkflowPayload = {
  event:
    | "new_requirement_created"
    | "task_ready_for_review"
    | "review_rejected"
    | "review_accepted_reusable";
  record_id: string;
  table_name?: string;
};

const FEISHU_API = "https://open.feishu.cn/open-apis";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    return asText(item.text ?? item.name ?? item.value ?? "");
  }
  return "";
}

function taskNumberValue(value: unknown) {
  const text = asText(value).trim();
  return /^TASK-\d{4}$/.test(text) ? text : "";
}

async function feishuFetch<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${FEISHU_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`Feishu API error ${data.code}: ${data.msg ?? JSON.stringify(data)}`);
  }
  return data;
}

async function getTenantToken() {
  const response = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: requiredEnv("FEISHU_APP_ID"),
      app_secret: requiredEnv("FEISHU_APP_SECRET"),
    }),
    cache: "no-store",
  });
  const data = await response.json();
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get tenant token: ${data.msg ?? JSON.stringify(data)}`);
  }
  return data.tenant_access_token as string;
}

async function listTables(token: string) {
  const appToken = requiredEnv("FEISHU_BASE_APP_TOKEN");
  const data = await feishuFetch<{
    data: { items: Array<{ name: string; table_id: string }> };
  }>(`/bitable/v1/apps/${appToken}/tables?page_size=100`, token);
  return new Map(data.data.items.map((table) => [table.name, table.table_id]));
}

async function listRecords(token: string, tableId: string) {
  const appToken = requiredEnv("FEISHU_BASE_APP_TOKEN");
  const data = await feishuFetch<{ data: { items: FeishuRecord[] } }>(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`,
    token,
  );
  return data.data.items ?? [];
}

async function getRecord(token: string, tableId: string, recordId: string) {
  const appToken = requiredEnv("FEISHU_BASE_APP_TOKEN");
  const data = await feishuFetch<{ data: { record: FeishuRecord } }>(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    token,
  );
  return data.data.record;
}

async function createRecord(token: string, tableId: string, fields: Record<string, unknown>) {
  const appToken = requiredEnv("FEISHU_BASE_APP_TOKEN");
  return feishuFetch(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, token, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
}

async function updateRecord(
  token: string,
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>,
) {
  const appToken = requiredEnv("FEISHU_BASE_APP_TOKEN");
  return feishuFetch(
    `/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ fields }),
    },
  );
}

function getTable(tables: Map<string, string>, name: string) {
  const id = tables.get(name);
  if (!id) throw new Error(`Table not found: ${name}`);
  return id;
}

function findByTaskNumber(records: FeishuRecord[], taskNumber: string) {
  return records.find((record) => taskNumberValue(record.fields["任务编号"]) === taskNumber);
}

function nextTaskNumber(records: FeishuRecord[]) {
  const max = records.reduce((currentMax, record) => {
    const taskNumber = taskNumberValue(record.fields["任务编号"]);
    const match = taskNumber.match(/^TASK-(\d{4})$/);
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return `TASK-${String(max + 1).padStart(4, "0")}`;
}

async function handleNewRequirement(token: string, tables: Map<string, string>, recordId: string) {
  const requirementTable = getTable(tables, "01_需求提交台");
  const taskTable = getTable(tables, "02_任务工作台");
  const requirement = await getRecord(token, requirementTable, recordId);
  const existingRequirements = await listRecords(token, requirementTable);
  const taskNumber =
    taskNumberValue(requirement.fields["任务编号"]) || nextTaskNumber(existingRequirements);

  const existingTasks = await listRecords(token, taskTable);
  const taskExists = findByTaskNumber(existingTasks, taskNumber);

  await updateRecord(token, requirementTable, recordId, {
    任务编号: taskNumber,
    需求状态: taskExists ? "制作中" : "待分配",
    信息完整度: "完整",
    下一步动作: taskExists ? "查看02_任务工作台推进制作" : "Leader分配负责人和承诺交付日",
  });

  if (!taskExists) {
    await createRecord(token, taskTable, {
      任务编号: taskNumber,
      项目: asText(requirement.fields["项目"]),
      资源类型: asText(requirement.fields["资源类型"]),
      任务名称: asText(requirement.fields["需求名称"]),
      优先级: asText(requirement.fields["优先级"]) || "P2",
      任务状态: "待分配",
      期望完成: requirement.fields["期望完成"],
      风险等级: "正常",
      下一步动作: "Leader分配负责人",
      Leader备注: "由飞书自动化创建",
    });
  }

  return { taskNumber, createdTask: !taskExists };
}

async function handleTaskReadyForReview(
  token: string,
  tables: Map<string, string>,
  recordId: string,
) {
  const taskTable = getTable(tables, "02_任务工作台");
  const reviewTable = getTable(tables, "03_审核交付台");
  const requirementTable = getTable(tables, "01_需求提交台");
  const task = await getRecord(token, taskTable, recordId);
  const taskNumber = taskNumberValue(task.fields["任务编号"]);
  if (!taskNumber) throw new Error("Task record does not have a valid 任务编号");

  const existingReviews = await listRecords(token, reviewTable);
  const existingReview = findByTaskNumber(existingReviews, taskNumber);
  const reviewFields = {
    任务编号: taskNumber,
    任务名称: asText(task.fields["任务名称"]),
    当前任务状态: asText(task.fields["任务状态"]) || "待审核",
    交付人: asText(task.fields["负责人"]),
    审核结果: "待审核",
    流转状态: "待审核",
    下一步动作: "审核人填写审核结果和审核意见",
  };

  if (existingReview) {
    await updateRecord(token, reviewTable, existingReview.record_id, reviewFields);
  } else {
    await createRecord(token, reviewTable, reviewFields);
  }

  const requirements = await listRecords(token, requirementTable);
  const requirement = findByTaskNumber(requirements, taskNumber);
  if (requirement) {
    await updateRecord(token, requirementTable, requirement.record_id, {
      需求状态: "待审核",
      下一步动作: "等待审核人处理",
    });
  }

  return { taskNumber, createdReview: !existingReview };
}

async function handleReviewRejected(token: string, tables: Map<string, string>, recordId: string) {
  const reviewTable = getTable(tables, "03_审核交付台");
  const taskTable = getTable(tables, "02_任务工作台");
  const review = await getRecord(token, reviewTable, recordId);
  const taskNumber = taskNumberValue(review.fields["任务编号"]);
  if (!taskNumber) throw new Error("Review record does not have a valid 任务编号");

  const tasks = await listRecords(token, taskTable);
  const task = findByTaskNumber(tasks, taskNumber);
  if (task) {
    await updateRecord(token, taskTable, task.record_id, {
      任务状态: "进行中",
      风险等级: "关注",
      当前卡点: asText(review.fields["返工原因"]) || "审核未通过",
      下一步动作: asText(review.fields["审核意见"]) || "根据审核意见返工后重新提交审核",
    });
  }

  await updateRecord(token, reviewTable, recordId, {
    流转状态: "返工中",
    下一步动作: "交付人按审核意见返工",
  });

  return { taskNumber, updatedTask: Boolean(task) };
}

async function handleReusableAsset(token: string, tables: Map<string, string>, recordId: string) {
  const reviewTable = getTable(tables, "03_审核交付台");
  const assetTable = getTable(tables, "04_美术资源库");
  const review = await getRecord(token, reviewTable, recordId);
  const taskNumber = taskNumberValue(review.fields["任务编号"]);
  if (!taskNumber) throw new Error("Review record does not have a valid 任务编号");

  const assets = await listRecords(token, assetTable);
  const existingAsset = findByTaskNumber(assets, taskNumber);
  if (!existingAsset) {
    await createRecord(token, assetTable, {
      资源名称: asText(review.fields["任务名称"]) || `${taskNumber} 资源`,
      任务编号: taskNumber,
      资源状态: "草稿",
      是否可复用: "是",
      使用场景: "由验收通过任务自动生成，待资源管理员补充",
      复用建议: "补齐资源路径、源文件路径和适用范围",
    });
  }

  await updateRecord(token, reviewTable, recordId, {
    流转状态: "已验收",
    下一步动作: existingAsset ? "资源库已存在记录" : "资源管理员补齐资源库记录",
  });

  return { taskNumber, createdAsset: !existingAsset };
}

export async function runFeishuWorkflow(payload: WorkflowPayload) {
  const token = await getTenantToken();
  const tables = await listTables(token);

  switch (payload.event) {
    case "new_requirement_created":
      return handleNewRequirement(token, tables, payload.record_id);
    case "task_ready_for_review":
      return handleTaskReadyForReview(token, tables, payload.record_id);
    case "review_rejected":
      return handleReviewRejected(token, tables, payload.record_id);
    case "review_accepted_reusable":
      return handleReusableAsset(token, tables, payload.record_id);
    default:
      throw new Error(`Unsupported event: ${(payload as { event?: string }).event}`);
  }
}

export type { WorkflowPayload };
