"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, TaskStatusBadge } from "@/components/status-badge";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { useAppData } from "@/lib/hooks/use-app-data";
import { cn, formatDate } from "@/lib/utils";

export default function MyBoardPage() {
  const { tasks, currentUser, loading } = useAppData();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const mine = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tasks
      .filter((task) => task.assignee_id === currentUser?.id)
      .filter((task) => {
        const matchesSearch =
          !normalizedSearch ||
          task.title.toLowerCase().includes(normalizedSearch) ||
          task.projects?.name?.toLowerCase().includes(normalizedSearch);
        return matchesSearch && (status === "all" || task.status === status);
      });
  }, [tasks, currentUser?.id, search, status]);

  return (
    <>
      <PageHeader title="我的任务" description="只展示分配给当前登录用户的美术需求。" />

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            className="h-10 flex-1 bg-transparent text-sm outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索我的任务或项目"
          />
        </div>
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">全部状态</option>
          {TASK_STATUSES.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {mine.map((task) => (
          <article key={task.id} className={cn("panel p-5", task.priority === "P0" && "border-red-300")}>
            <div className="mb-3 flex items-center justify-between">
              <PriorityBadge priority={task.priority} />
              <TaskStatusBadge status={task.status} />
            </div>
            <h2 className="text-lg font-semibold text-slate-950">{task.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{task.projects?.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">开始</div>
                <div className="mt-1 font-medium text-slate-800">{formatDate(task.start_date)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs text-slate-500">截止</div>
                <div className="mt-1 font-medium text-slate-800">{formatDate(task.end_date)}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[...task.module, ...task.style, ...task.content].map((item) => (
                <span key={item} className="tag">
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
        {!loading && mine.length === 0 && <div className="panel p-6 text-sm text-slate-500">当前没有匹配的任务。</div>}
      </div>
    </>
  );
}
