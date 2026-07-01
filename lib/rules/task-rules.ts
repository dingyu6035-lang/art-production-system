import type { Task, TaskWithRelations } from "@/types/database";

type RuleTask = Partial<Task | TaskWithRelations>;

export type TaskValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateTask(task: RuleTask): TaskValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!task.project_id) errors.push("必须选择项目");
  if (!task.assignee_id) errors.push("必须指定负责人");
  if (!task.reviewer_id) errors.push("必须指定验收人");
  if (!task.priority) errors.push("必须设置优先级");

  if (task.start_date && task.end_date) {
    const startDate = new Date(task.start_date);
    const endDate = new Date(task.end_date);
    if (endDate < startDate) errors.push("结束时间不能早于开始时间");
  }

  if (!task.module?.length) errors.push("必须至少选择一个模块");
  if (!task.style?.length) errors.push("必须至少选择一个风格");
  if (!task.content?.length) warnings.push("建议选择交付内容，便于美术理解产出范围");
  if (!task.end_date) warnings.push("建议设置截止时间，便于 PM 追踪排期");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
