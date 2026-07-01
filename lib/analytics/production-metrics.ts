import type { SupabaseClient } from "@supabase/supabase-js";
import { taskSelect } from "@/lib/data/queries";
import { getSystemHealth } from "@/lib/audit/system-health";
import { validateTask } from "@/lib/rules/task-rules";
import type { Project, TaskStatus, TaskWithRelations } from "@/types/database";

export type BottleneckReason =
  | "超过 3 天未开始"
  | "超期未完成"
  | "审核中但缺少资源"
  | "疑似多轮返修";

export type BottleneckTask = TaskWithRelations & {
  reasons: BottleneckReason[];
  assetCount: number;
};

export type ProjectHealth = {
  project: Project;
  project_health_score: number;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  tasksWithAssets: number;
  ruleViolations: number;
};

export type ProductionMetrics = {
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  averageCompletionDays: number;
  overdueTasks: number;
  tasksWithoutAssets: number;
  overdueRate: number;
  taskThroughput: Array<{ label: string; count: number }>;
  statusFunnel: Array<{ status: TaskStatus; label: string; count: number }>;
  bottleneckTasks: BottleneckTask[];
  projectHealth: ProjectHealth[];
  ruleViolationCount: number;
  systemHealthScore: number;
};

const statusLabels: Record<TaskStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  review: "审核中",
  revising: "返修中",
  done: "已完成",
};

async function getAnalyticsSnapshot(supabase: SupabaseClient) {
  try {
    const [projectsResult, tasksResult, assetsResult, health] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select(taskSelect).order("created_at", { ascending: false }),
      supabase.from("assets").select("task_id,created_at,version"),
      getSystemHealth(supabase),
    ]);

    const firstError = projectsResult.error || tasksResult.error || assetsResult.error;
    if (firstError) throw firstError;

    const assetsByTaskId = (assetsResult.data || []).reduce<Record<string, number>>((acc, asset) => {
      const taskId = asset.task_id as string;
      acc[taskId] = (acc[taskId] || 0) + 1;
      return acc;
    }, {});

    return {
      projects: (projectsResult.data || []) as Project[],
      tasks: (tasksResult.data || []) as TaskWithRelations[],
      assetsByTaskId,
      health,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error("生产效率数据读取失败");
  }
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
}

export function getAverageCompletionTime(tasks: TaskWithRelations[]) {
  const completedDurations = tasks
    .filter((task) => task.status === "done")
    .map((task) => daysBetween(task.start_date || task.created_at, task.end_date || task.created_at))
    .filter((value): value is number => value !== null);

  if (completedDurations.length === 0) return 0;
  const total = completedDurations.reduce((sum, value) => sum + value, 0);
  return Math.round((total / completedDurations.length) * 10) / 10;
}

export function getOverdueRate(tasks: TaskWithRelations[]) {
  if (tasks.length === 0) return 0;
  const today = startOfToday();
  const overdueCount = tasks.filter((task) => {
    if (!task.end_date || task.status === "done") return false;
    return new Date(task.end_date) < today;
  }).length;
  return Math.round((overdueCount / tasks.length) * 1000) / 10;
}

export function getTaskThroughput(tasks: TaskWithRelations[]) {
  const buckets = new Map<string, number>();
  tasks
    .filter((task) => task.status === "done")
    .forEach((task) => {
      const date = task.end_date || task.created_at;
      const label = date.slice(0, 10);
      buckets.set(label, (buckets.get(label) || 0) + 1);
    });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([label, count]) => ({ label: label.slice(5), count }));
}

export function getBottleneckTasks(tasks: TaskWithRelations[], assetsByTaskId: Record<string, number>) {
  const today = startOfToday();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);

  return tasks
    .map((task) => {
      const reasons: BottleneckReason[] = [];
      const createdAt = new Date(task.created_at);
      const assetCount = assetsByTaskId[task.id] || 0;

      if (task.status === "not_started" && createdAt < threeDaysAgo) reasons.push("超过 3 天未开始");
      if (task.end_date && new Date(task.end_date) < today && task.status !== "done") reasons.push("超期未完成");
      if (task.status === "review" && assetCount === 0) reasons.push("审核中但缺少资源");
      if (task.status === "revising" && assetCount >= 2) reasons.push("疑似多轮返修");

      return { ...task, reasons, assetCount };
    })
    .filter((task) => task.reasons.length > 0);
}

function calculateProjectHealth(project: Project, tasks: TaskWithRelations[], assetsByTaskId: Record<string, number>) {
  if (tasks.length === 0) {
    return {
      project,
      project_health_score: 100,
      totalTasks: 0,
      doneTasks: 0,
      overdueTasks: 0,
      tasksWithAssets: 0,
      ruleViolations: 0,
    };
  }

  const today = startOfToday();
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const overdueTasks = tasks.filter((task) => task.end_date && new Date(task.end_date) < today && task.status !== "done").length;
  const tasksWithAssets = tasks.filter((task) => Boolean(assetsByTaskId[task.id])).length;
  const normalFlowTasks = tasks.filter((task) => !(task.status === "review" && !assetsByTaskId[task.id])).length;
  const ruleViolations = tasks.filter((task) => !validateTask(task).valid).length;

  const score =
    (doneTasks / tasks.length) * 30 +
    ((tasks.length - overdueTasks) / tasks.length) * 20 +
    (tasksWithAssets / tasks.length) * 20 +
    (normalFlowTasks / tasks.length) * 20 +
    ((tasks.length - ruleViolations) / tasks.length) * 10;

  return {
    project,
    project_health_score: Math.round(score),
    totalTasks: tasks.length,
    doneTasks,
    overdueTasks,
    tasksWithAssets,
    ruleViolations,
  };
}

export async function getProductionMetrics(supabase: SupabaseClient): Promise<ProductionMetrics> {
  const { projects, tasks, assetsByTaskId, health } = await getAnalyticsSnapshot(supabase);
  const today = startOfToday();
  const overdueTasks = tasks.filter((task) => task.end_date && new Date(task.end_date) < today && task.status !== "done").length;

  return {
    totalTasks: tasks.length,
    doneTasks: tasks.filter((task) => task.status === "done").length,
    inProgressTasks: tasks.filter((task) => task.status === "in_progress").length,
    averageCompletionDays: getAverageCompletionTime(tasks),
    overdueTasks,
    tasksWithoutAssets: tasks.filter((task) => !assetsByTaskId[task.id]).length,
    overdueRate: getOverdueRate(tasks),
    taskThroughput: getTaskThroughput(tasks),
    statusFunnel: (["not_started", "in_progress", "review", "done"] as TaskStatus[]).map((status) => ({
      status,
      label: statusLabels[status],
      count: tasks.filter((task) => task.status === status).length,
    })),
    bottleneckTasks: getBottleneckTasks(tasks, assetsByTaskId),
    projectHealth: projects
      .map((project) => calculateProjectHealth(project, tasks.filter((task) => task.project_id === project.id), assetsByTaskId))
      .sort((a, b) => b.project_health_score - a.project_health_score),
    ruleViolationCount: health.issues.ruleViolations.length,
    systemHealthScore: health.score,
  };
}
