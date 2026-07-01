"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { BarChart3, Bug, Columns3, Plus, UploadCloud } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
import { ErrorState, LoadingSkeleton } from "@/components/state-views";
import { getProductionMetrics } from "@/lib/analytics/production-metrics";
import { getSystemHealth } from "@/lib/audit/system-health";
import { taskSelect } from "@/lib/data/queries";
import { createClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/utils";
import type { TaskWithRelations, UserProfile } from "@/types/database";

async function getDashboardData() {
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const [profileResult, tasksResult, health, metrics] = await Promise.all([
      supabase.from("users").select("*").eq("id", auth.user?.id || "").single(),
      supabase.from("tasks").select(taskSelect).order("created_at", { ascending: false }),
      getSystemHealth(supabase),
      getProductionMetrics(supabase),
    ]);

    const firstError = profileResult.error || tasksResult.error;
    if (firstError) throw firstError;

    return {
      profile: profileResult.data as UserProfile,
      tasks: (tasksResult.data || []) as TaskWithRelations[],
      health,
      metrics,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error("工作台数据读取失败");
  }
}

function TaskList({ title, tasks }: { title: string; tasks: TaskWithRelations[] }) {
  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-200 p-4 font-semibold text-slate-950">{title}</div>
      <div className="divide-y divide-slate-100">
        {tasks.slice(0, 6).map((task) => (
          <Link key={task.id} href={`/tasks?task=${task.id}`} className="block p-4 transition hover:bg-blue-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-950">{task.title}</div>
                <div className="mt-1 text-sm text-slate-500">{task.projects?.name || "未关联项目"} · {formatDate(task.end_date)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PriorityBadge priority={task.priority} />
                <TaskStatusBadge status={task.status} />
              </div>
            </div>
          </Link>
        ))}
        {tasks.length === 0 && <div className="p-4 text-sm text-slate-500">暂无任务。</div>}
      </div>
    </section>
  );
}

function DashboardContent() {
  const { data, error, isLoading, mutate } = useSWR("operational-dashboard", getDashboardData, {
    revalidateOnFocus: true,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("operational-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => mutate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  const tasks = data?.tasks || [];
  const myTasks = tasks.filter((task) => task.assignee_id === data?.profile.id);
  const weekEnd = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(23, 59, 59, 999);
    return date;
  }, []);

  const todayTasks = tasks
    .filter((task) => task.status !== "done")
    .filter((task) => task.priority === "P0" || task.status === "review")
    .sort((a, b) => (a.priority === "P0" ? -1 : 1) - (b.priority === "P0" ? -1 : 1));

  const thisWeekTasks = myTasks.filter((task) => task.end_date && new Date(task.end_date) <= weekEnd && task.status !== "done");
  const efficiencyScore = Math.round(
    (data?.metrics.projectHealth.reduce((sum, item) => sum + item.project_health_score, 0) || 0) /
      Math.max(data?.metrics.projectHealth.length || 1, 1)
  );

  return (
    <>
      <PageHeader title="工作台" description="只看任务、待办、状态和入口。" />
      {isLoading && <LoadingSkeleton rows={6} />}
      {error && <ErrorState message={error.message} reset={() => mutate()} />}

      {!isLoading && !error && (
      <div className="grid gap-6">
        <div className="grid gap-4 xl:grid-cols-2">
          <TaskList title="我的任务" tasks={myTasks} />
          <TaskList title="今日待处理" tasks={todayTasks.length ? todayTasks : thisWeekTasks} />
        </div>

        <section className="panel grid gap-4 p-5 md:grid-cols-4">
          <div>
            <div className="text-sm text-slate-500">系统健康</div>
            <div className="mt-2 text-3xl font-bold text-slate-950">{isLoading ? "--" : data?.health.score}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">生产效率</div>
            <div className="mt-2 text-3xl font-bold text-slate-950">{isLoading ? "--" : efficiencyScore}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">违规任务</div>
            <div className="mt-2 text-3xl font-bold text-slate-950">{data?.metrics.ruleViolationCount || 0}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">瓶颈任务</div>
            <div className="mt-2 text-3xl font-bold text-slate-950">{data?.metrics.bottleneckTasks.length || 0}</div>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 font-semibold text-slate-950">快捷操作</div>
          <div className="grid gap-3 md:grid-cols-5">
            <Link className="button-primary" href="/tasks/new"><Plus className="h-4 w-4" />创建任务</Link>
            <Link className="button-secondary" href="/kanban"><Columns3 className="h-4 w-4" />看板</Link>
            <Link className="button-secondary" href="/upload"><UploadCloud className="h-4 w-4" />上传资源</Link>
            <Link className="button-secondary" href="/analytics"><BarChart3 className="h-4 w-4" />分析</Link>
            <Link className="button-secondary" href="/debug"><Bug className="h-4 w-4" />健康</Link>
          </div>
        </section>
      </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </AuthGuard>
  );
}
