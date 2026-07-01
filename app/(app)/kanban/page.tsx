"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge } from "@/components/status-badge";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/state-views";
import { KANBAN_STATUSES, STATUS_LABELS, VALID_STATUS_MOVES } from "@/lib/constants";
import { useAppData } from "@/lib/hooks/use-app-data";
import { createClient } from "@/lib/supabase/browser";
import { cn, compactName, formatDate } from "@/lib/utils";
import type { TaskStatus, TaskWithRelations } from "@/types/database";

function Avatar({ name, email }: { name?: string | null; email?: string | null }) {
  const label = compactName(name, email);
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
        {label.slice(0, 1).toUpperCase()}
      </span>
      <span className="truncate text-xs text-slate-500">{label}</span>
    </div>
  );
}

export default function KanbanPage() {
  const { tasks, loading, error, reload, canMoveTaskStatus } = useAppData();
  const [localTasks, setLocalTasks] = useState<TaskWithRelations[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);

  useEffect(() => setLocalTasks(tasks), [tasks]);

  const columns = useMemo(
    () =>
      KANBAN_STATUSES.map((status) => ({
        status,
        tasks: localTasks
          .filter((task) => task.status === status)
          .sort((a, b) => (a.priority === "P0" ? -1 : 0) - (b.priority === "P0" ? -1 : 0)),
      })),
    [localTasks]
  );

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const from = source.droppableId as TaskStatus;
    const to = destination.droppableId as TaskStatus;
    if (!VALID_STATUS_MOVES[from]?.includes(to)) {
      alert(`不允许从 ${STATUS_LABELS[from]} 直接流转到 ${STATUS_LABELS[to]}`);
      return;
    }

    const targetTask = localTasks.find((task) => task.id === draggableId);
    if (!targetTask) return;
    const guard = await canMoveTaskStatus(targetTask, to);
    if (!guard.allowed) {
      alert(guard.errors.join("\n"));
      return;
    }

    const previousTasks = localTasks;
    setSyncingTaskId(draggableId);
    setLocalTasks((current) => current.map((task) => (task.id === draggableId ? { ...task, status: to } : task)));

    const supabase = createClient();
    const { error } = await supabase.from("tasks").update({ status: to }).eq("id", draggableId);
    setSyncingTaskId(null);
    if (error) {
      setLocalTasks(previousTasks);
      alert(error.message);
      return;
    }
    reload();
  }

  return (
    <>
      <PageHeader title="看板" description="拖拽任务推进状态，点击卡片查看详情。" />
      {loading && <LoadingSkeleton rows={6} />}
      {error && <ErrorState message={error} />}
      {!loading && !error && tasks.length === 0 && <EmptyState title="暂无任务" description="创建任务后即可在看板中流转。" />}
      {!loading && !error && tasks.length > 0 && (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid gap-4 xl:grid-cols-4">
          {columns.map((column) => (
            <section key={column.status} className="rounded-xl border border-slate-200 bg-slate-100 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">{STATUS_LABELS[column.status]}</h2>
                <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-500">{column.tasks.length}</span>
              </div>
              <Droppable droppableId={column.status}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-96 space-y-3">
                    {column.tasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <article
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            onClick={() => setExpandedId(expandedId === task.id ? null : task.id)}
                            className={cn(
                              "cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition",
                              task.priority === "P0" ? "border-red-300" : "border-slate-200",
                              snapshot.isDragging && "shadow-soft",
                              syncingTaskId === task.id && "opacity-60"
                            )}
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <PriorityBadge priority={task.priority} />
                              <span className="text-xs font-semibold text-slate-500">{formatDate(task.end_date)}</span>
                            </div>
                            <h3 className="line-clamp-2 font-semibold text-slate-950">{task.title}</h3>
                            <div className="mt-4"><Avatar name={task.assignee?.name} email={task.assignee?.email} /></div>
                            {expandedId === task.id && (
                              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                                <div>项目：{task.projects?.name || "-"}</div>
                                <div className="mt-1">模块：{task.module.join("、") || "-"}</div>
                                <div className="mt-1">验收：{compactName(task.reviewer?.name, task.reviewer?.email)}</div>
                              </div>
                            )}
                          </article>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </section>
          ))}
        </div>
      </DragDropContext>
      )}
    </>
  );
}
