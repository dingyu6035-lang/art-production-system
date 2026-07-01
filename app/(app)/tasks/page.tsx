"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Send, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/state-views";
import { STATUS_LABELS, TASK_TYPE_LABELS } from "@/lib/constants";
import { useAppData } from "@/lib/hooks/use-app-data";
import { validateTask } from "@/lib/rules/task-rules";
import { createClient } from "@/lib/supabase/browser";
import { cn, compactName, formatDate } from "@/lib/utils";
import type { TaskStatus, TaskWithRelations } from "@/types/database";

const PAGE_SIZE = 20;

export default function TasksPage() {
  const searchParams = useSearchParams();
  const focusTaskId = searchParams.get("task");
  const { tasks, loading, error, reload, canMoveTaskStatus } = useAppData();
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const visible = focusTaskId ? tasks.filter((task) => task.id === focusTaskId) : tasks;
    return [...visible].sort((a, b) => {
      const priorityDiff = (a.priority === "P0" ? 0 : 1) - (b.priority === "P0" ? 0 : 1);
      if (priorityDiff !== 0) return priorityDiff;
      const aDue = a.end_date ? new Date(a.end_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.end_date ? new Date(b.end_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    });
  }, [tasks, focusTaskId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleTasks = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function updateStatus(task: TaskWithRelations, status: TaskStatus) {
    const guard = await canMoveTaskStatus(task, status);
    if (!guard.allowed) {
      alert(guard.errors.join("\n"));
      return;
    }

    setUpdatingId(task.id);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    setUpdatingId(null);
    if (updateError) {
      alert(updateError.message);
      return;
    }
    reload();
  }

  return (
    <>
      <PageHeader title="任务" description="一个任务就是一个操作单位。" />
      {loading && <LoadingSkeleton rows={6} />}
      {error && <ErrorState message={error} />}

      {focusTaskId && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
          <span>已定位到指定任务。</span>
          <Link className="font-semibold" href="/tasks">清除定位</Link>
        </div>
      )}

      {!loading && !error && (
      <div className="panel overflow-hidden">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleTasks.map((task) => {
              const validation = validateTask(task);
              const reasons = [...validation.errors, ...validation.warnings];
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "group bg-white",
                    task.priority === "P0" && "border-l-4 border-l-red-500 bg-red-50/40",
                    focusTaskId === task.id && "ring-2 ring-inset ring-blue-500"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-950">{task.title}</div>
                    <div className="mt-2 hidden text-xs text-slate-500 group-hover:block">
                      {task.projects?.name || "未关联项目"} · {TASK_TYPE_LABELS[task.type]} · 负责人 {compactName(task.assignee?.name, task.assignee?.email)}
                    </div>
                  </td>
                  <td className="px-4 py-3"><TaskStatusBadge status={task.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span>{formatDate(task.end_date)}</span>
                      {reasons.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700" title={reasons.join("\n")}>
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="button-secondary h-8 px-3" disabled={updatingId === task.id || task.status === "done"} onClick={() => updateStatus(task, "done")}>
                        <Check className="h-3 w-3" />完成
                      </button>
                      <button className="button-secondary h-8 px-3" disabled={updatingId === task.id || task.status === "review" || task.status === "done"} onClick={() => updateStatus(task, "review")}>
                        <Send className="h-3 w-3" />提交审核
                      </button>
                      <Link className="button-secondary h-8 px-3" href={`/upload?task=${task.id}`}>
                        <UploadCloud className="h-3 w-3" />上传资源
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleTasks.length === 0 && <div className="p-6"><EmptyState title="暂无任务" description="当前没有可处理的任务。" /></div>}
      </div>
      )}

      {!loading && !error && (
      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
        <span>共 {filtered.length} 条</span>
        <div className="flex items-center gap-2">
          <button className="button-secondary" disabled={page <= 1 || Boolean(focusTaskId)} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button>
          <span>{page} / {pageCount}</span>
          <button className="button-secondary" disabled={page >= pageCount || Boolean(focusTaskId)} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页</button>
        </div>
      </div>
      )}
    </>
  );
}
