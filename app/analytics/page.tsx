"use client";

import Link from "next/link";
import { useEffect } from "react";
import useSWR from "swr";
import { Activity, BarChart3, Gauge, GitBranch, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
import { getProductionMetrics } from "@/lib/analytics/production-metrics";
import { createClient } from "@/lib/supabase/browser";
import { cn, formatDate } from "@/lib/utils";

function KpiCard({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="panel p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-950">
        {value}
        {suffix && <span className="ml-1 text-base font-semibold text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: Array<{ label: string; count: number }> }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <section className="panel p-5">
      <div className="mb-5 flex items-center gap-2 font-semibold text-slate-950">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        时间周期图
      </div>
      <div className="flex h-56 items-end gap-3">
        {data.length === 0 && <div className="text-sm text-slate-500">暂无完成任务数据。</div>}
        {data.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-end justify-center rounded-t-xl bg-blue-100" style={{ height: `${Math.max(12, (item.count / max) * 180)}px` }}>
              <span className="mb-2 text-xs font-bold text-blue-700">{item.count}</span>
            </div>
            <span className="text-xs text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Funnel({ data }: { data: Array<{ label: string; count: number }> }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  return (
    <section className="panel p-5">
      <div className="mb-5 flex items-center gap-2 font-semibold text-slate-950">
        <GitBranch className="h-4 w-4 text-blue-600" />
        任务流转漏斗
      </div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-500">{item.count}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-blue-600" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticsContent() {
  const { data, error, isLoading, mutate } = useSWR(
    "production-metrics",
    () => getProductionMetrics(createClient()),
    { revalidateOnFocus: true }
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("analytics-metrics")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, () => mutate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  return (
    <>
      <PageHeader
        title="生产效率分析"
        description="分析任务吞吐、项目健康度和流程瓶颈，为 PM 提供决策依据。"
      />

      {error && <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</div>}

      <section className="panel mb-6 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black", (data?.systemHealthScore || 0) >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
              {isLoading ? "--" : data?.systemHealthScore}
            </div>
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <Gauge className="h-5 w-5 text-blue-600" />
                系统健康趋势入口
              </div>
              <p className="mt-1 text-sm text-slate-500">已接入 debug health 和 rule violations，当前规则违规 {data?.ruleViolationCount || 0} 项。</p>
            </div>
          </div>
          <button className="button-secondary" onClick={() => mutate()}>
            <Activity className="h-4 w-4" />
            刷新分析
          </button>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="总任务数" value={data?.totalTasks || 0} />
        <KpiCard label="已完成任务" value={data?.doneTasks || 0} />
        <KpiCard label="进行中任务" value={data?.inProgressTasks || 0} />
        <KpiCard label="平均完成周期" value={data?.averageCompletionDays || 0} suffix="days" />
        <KpiCard label="超期任务数" value={data?.overdueTasks || 0} />
        <KpiCard label="资源缺失任务" value={data?.tasksWithoutAssets || 0} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <SimpleBarChart data={data?.taskThroughput || []} />
        <Funnel data={data?.statusFunnel || []} />
      </div>

      <section className="panel mb-6 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 p-4 font-semibold text-slate-950">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          项目健康排行
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.projectHealth || []).map((item) => (
            <div key={item.project.id} className="grid gap-3 p-4 md:grid-cols-[1fr_120px_1fr] md:items-center">
              <div>
                <div className="font-semibold text-slate-950">{item.project.name}</div>
                <div className="mt-1 text-sm text-slate-500">
                  任务 {item.totalTasks} · 完成 {item.doneTasks} · 超期 {item.overdueTasks} · 规则违规 {item.ruleViolations}
                </div>
              </div>
              <div className="text-2xl font-black text-slate-950">{item.project_health_score}</div>
              <div className="h-3 rounded-full bg-slate-100">
                <div
                  className={cn("h-3 rounded-full", item.project_health_score >= 80 ? "bg-emerald-500" : item.project_health_score >= 60 ? "bg-orange-500" : "bg-red-500")}
                  style={{ width: `${item.project_health_score}%` }}
                />
              </div>
            </div>
          ))}
          {!isLoading && (data?.projectHealth || []).length === 0 && <div className="p-4 text-sm text-slate-500">暂无项目数据。</div>}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-950">瓶颈任务列表</h2>
          <p className="mt-1 text-sm text-slate-500">识别未启动、超期、审核缺资源和疑似多轮返修任务。</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.bottleneckTasks || []).map((task) => (
            <Link key={task.id} href={`/tasks?task=${task.id}`} className="block p-4 transition hover:bg-blue-50">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">{task.title}</span>
                    <PriorityBadge priority={task.priority} />
                    <TaskStatusBadge status={task.status} />
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    项目：{task.projects?.name || "未知项目"} · 截止：{formatDate(task.end_date)} · 资源版本：{task.assetCount}
                  </div>
                </div>
                <div className="max-w-xl rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">
                  {task.reasons.join("；")}
                </div>
              </div>
            </Link>
          ))}
          {!isLoading && (data?.bottleneckTasks || []).length === 0 && <div className="p-4 text-sm text-emerald-700">未发现瓶颈任务。</div>}
        </div>
      </section>
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <AnalyticsContent />
      </AppShell>
    </AuthGuard>
  );
}
