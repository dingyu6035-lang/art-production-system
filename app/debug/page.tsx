"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, CheckCircle2, Database, ShieldCheck, Wrench } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
import { getSystemHealth, type AuditTask } from "@/lib/audit/system-health";
import { createClient } from "@/lib/supabase/browser";
import { cn, formatDate } from "@/lib/utils";

const repairActions = [
  "批量补全负责人",
  "标记为超期任务",
  "清理无效任务",
];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function IssueList({
  title,
  description,
  tasks,
  missingField,
}: {
  title: string;
  description: string;
  tasks: AuditTask[];
  missingField: string;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className={cn("rounded-xl px-3 py-1 text-sm font-bold", tasks.length ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
          {tasks.length}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.map((task) => (
          <Link
            key={`${title}-${task.id}`}
            href={`/tasks?task=${task.id}`}
            className="block bg-white p-4 transition hover:bg-blue-50"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">{task.title}</span>
                  <PriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.status} />
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  项目：{task.projects?.name || "未知项目"} · 截止：{formatDate(task.end_date)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                缺失字段：{task.missingFields.join("、") || missingField}
              </div>
            </div>
          </Link>
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center gap-2 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            未发现该类问题。
          </div>
        )}
      </div>
    </section>
  );
}

function RuleViolationList({
  items,
}: {
  items: Array<{ task: AuditTask; errors: string[]; warnings: string[] }>;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div>
          <h2 className="font-semibold text-slate-950">规则违规列表</h2>
          <p className="mt-1 text-sm text-slate-500">由 Production Rules Layer 检测出的任务规范问题。</p>
        </div>
        <span className={cn("rounded-xl px-3 py-1 text-sm font-bold", items.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <Link
            key={`rule-${item.task.id}`}
            href={`/tasks?task=${item.task.id}`}
            className="block bg-white p-4 transition hover:bg-blue-50"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-950">{item.task.title}</span>
                  <PriorityBadge priority={item.task.priority} />
                  <TaskStatusBadge status={item.task.status} />
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  项目：{item.task.projects?.name || "未知项目"}
                </div>
              </div>
              <div className="max-w-xl rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {[...item.errors, ...item.warnings].join("；")}
              </div>
            </div>
          </Link>
        ))}
        {items.length === 0 && (
          <div className="flex items-center gap-2 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            未发现规则违规任务。
          </div>
        )}
      </div>
    </section>
  );
}

function DebugContent() {
  const [repairHint, setRepairHint] = useState("");
  const { data, error, isLoading, mutate } = useSWR(
    "system-health",
    () => getSystemHealth(createClient()),
    { revalidateOnFocus: true }
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("debug-audit")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, () => mutate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  const score = data?.score ?? 0;

  return (
    <>
      <PageHeader
        title="系统健康与数据验证"
        description="用于 PM 验证真实协作流转、发现流程断点和定位卡住的任务。"
      />

      {error && <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error.message}</div>}

      <section className="panel mb-6 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-black", score >= 80 ? "bg-emerald-50 text-emerald-700" : score >= 60 ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700")}>
              {isLoading ? "--" : score}
            </div>
            <div>
              <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                系统健康评分
              </div>
              <p className="mt-1 text-sm text-slate-500">按任务完整度、资源提交、超期、负责人、验收人综合计算。</p>
            </div>
          </div>
          <button className="button-secondary" onClick={() => mutate()}>
            <Database className="h-4 w-4" />
            重新检测
          </button>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="总项目数" value={data?.stats.totalProjects || 0} />
        <StatCard label="总任务数" value={data?.stats.totalTasks || 0} />
        <StatCard label="未分配任务" value={data?.stats.unassignedTasks || 0} />
        <StatCard label="进行中任务" value={data?.stats.inProgressTasks || 0} />
        <StatCard label="待审核任务" value={data?.stats.reviewTasks || 0} />
        <StatCard label="已完成任务" value={data?.stats.doneTasks || 0} />
      </div>

      <section className="panel mb-6 p-5">
        <div className="mb-4 flex items-center gap-2 font-semibold text-slate-950">
          <Wrench className="h-4 w-4 text-blue-600" />
          数据修复入口（仅 UI 提示）
        </div>
        <div className="flex flex-wrap gap-3">
          {repairActions.map((action) => (
            <button
              key={action}
              className="button-secondary"
              onClick={() => setRepairHint(`${action}：此处仅提供诊断入口，不会直接修改数据库。`)}
            >
              {action}
            </button>
          ))}
        </div>
        {repairHint && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">{repairHint}</div>}
      </section>

      <div className="grid gap-6">
        <RuleViolationList items={data?.issues.ruleViolations || []} />
        <IssueList
          title="没有负责人的任务"
          description="这些任务无法进入明确执行责任。"
          tasks={data?.issues.unassignedTasks || []}
          missingField="负责人"
        />
        <IssueList
          title="没有验收人的任务"
          description="这些任务完成后缺少审核闭环。"
          tasks={data?.issues.tasksWithoutReviewer || []}
          missingField="验收人"
        />
        <IssueList
          title="超期未完成任务"
          description="end_date 已早于今天，且状态不是 done。"
          tasks={data?.issues.overdueTasks || []}
          missingField="状态/截止时间"
        />
        <IssueList
          title="没有资源提交的任务"
          description="这些任务尚未在 assets 表中形成可回溯交付。"
          tasks={data?.issues.tasksWithoutAssets || []}
          missingField="资源文件"
        />
      </div>
    </>
  );
}

export default function DebugPage() {
  return (
    <AuthGuard>
      <AppShell>
        <DebugContent />
      </AppShell>
    </AuthGuard>
  );
}
