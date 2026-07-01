import type { SupabaseClient } from "@supabase/supabase-js";
import { taskSelect } from "@/lib/data/queries";
import { validateTask } from "@/lib/rules/task-rules";
import type { Project, TaskWithRelations } from "@/types/database";

export type AuditTask = TaskWithRelations & {
  missingFields: string[];
  hasAssets: boolean;
  isOverdue: boolean;
};

export type SystemHealth = {
  score: number;
  projects: Project[];
  tasks: AuditTask[];
  assetsByTaskId: Record<string, number>;
  stats: {
    totalProjects: number;
    totalTasks: number;
    unassignedTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    doneTasks: number;
  };
  issues: {
    unassignedTasks: AuditTask[];
    tasksWithoutReviewer: AuditTask[];
    overdueTasks: AuditTask[];
    tasksWithoutAssets: AuditTask[];
    ruleViolations: Array<{
      task: AuditTask;
      errors: string[];
      warnings: string[];
    }>;
  };
};

async function getAuditSnapshot(supabase: SupabaseClient) {
  try {
    const [projectsResult, tasksResult, assetsResult] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select(taskSelect).order("created_at", { ascending: false }),
      supabase.from("assets").select("task_id"),
    ]);

    const firstError = projectsResult.error || tasksResult.error || assetsResult.error;
    if (firstError) throw firstError;

    const projects = (projectsResult.data || []) as Project[];
    const tasks = (tasksResult.data || []) as TaskWithRelations[];
    const assetsByTaskId = (assetsResult.data || []).reduce<Record<string, number>>((acc, asset) => {
      const taskId = asset.task_id as string;
      acc[taskId] = (acc[taskId] || 0) + 1;
      return acc;
    }, {});

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const auditTasks: AuditTask[] = tasks.map((task) => {
      const missingFields = [
        !task.assignee_id ? "负责人" : "",
        !task.reviewer_id ? "验收人" : "",
        !task.project_id ? "项目" : "",
      ].filter(Boolean);
      const endDate = task.end_date ? new Date(task.end_date) : null;
      const isOverdue = Boolean(endDate && endDate < today && task.status !== "done");

      return {
        ...task,
        missingFields,
        hasAssets: Boolean(assetsByTaskId[task.id]),
        isOverdue,
      };
    });

    return { projects, tasks: auditTasks, assetsByTaskId };
  } catch (error) {
    throw error instanceof Error ? error : new Error("系统健康数据读取失败");
  }
}

export async function getUnassignedTasks(supabase: SupabaseClient) {
  const { tasks } = await getAuditSnapshot(supabase);
  return tasks.filter((task) => !task.assignee_id);
}

export async function getOverdueTasks(supabase: SupabaseClient) {
  const { tasks } = await getAuditSnapshot(supabase);
  return tasks.filter((task) => task.isOverdue);
}

export async function getTasksWithoutAssets(supabase: SupabaseClient) {
  const { tasks } = await getAuditSnapshot(supabase);
  return tasks.filter((task) => !task.hasAssets);
}

export async function getSystemHealth(supabase: SupabaseClient): Promise<SystemHealth> {
  const { projects, tasks, assetsByTaskId } = await getAuditSnapshot(supabase);
  const maxPoints = Math.max(tasks.length * 10, 1);
  const points = tasks.reduce((total, task) => {
    const completeCore = Boolean(task.project_id && task.title && task.type && task.status && task.priority);
    return (
      total +
      (completeCore ? 2 : 0) +
      (task.hasAssets ? 2 : 0) +
      (!task.isOverdue ? 2 : 0) +
      (task.assignee_id ? 2 : 0) +
      (task.reviewer_id ? 2 : 0)
    );
  }, 0);

  return {
    score: tasks.length === 0 ? 100 : Math.round((points / maxPoints) * 100),
    projects,
    tasks,
    assetsByTaskId,
    stats: {
      totalProjects: projects.length,
      totalTasks: tasks.length,
      unassignedTasks: tasks.filter((task) => !task.assignee_id).length,
      inProgressTasks: tasks.filter((task) => task.status === "in_progress").length,
      reviewTasks: tasks.filter((task) => task.status === "review").length,
      doneTasks: tasks.filter((task) => task.status === "done").length,
    },
    issues: {
      unassignedTasks: tasks.filter((task) => !task.assignee_id),
      tasksWithoutReviewer: tasks.filter((task) => !task.reviewer_id),
      overdueTasks: tasks.filter((task) => task.isOverdue),
      tasksWithoutAssets: tasks.filter((task) => !task.hasAssets),
      ruleViolations: tasks
        .map((task) => ({ task, ...validateTask(task) }))
        .filter((item) => item.errors.length > 0 || item.warnings.length > 0),
    },
  };
}
