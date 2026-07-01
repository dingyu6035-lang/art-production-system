import { PROJECT_STATUS_LABELS, STATUS_LABELS } from "@/lib/constants";
import type { ProjectStatus, TaskStatus } from "@/types/database";

const taskTone: Record<TaskStatus, string> = {
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-orange-100 text-orange-700",
  revising: "bg-red-100 text-red-700",
  done: "bg-emerald-100 text-emerald-700",
};

const projectTone: Record<ProjectStatus, string> = {
  active: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${taskTone[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${projectTone[status]}`}>
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

const priorityTone = {
  P0: "border-red-200 bg-red-50 text-red-700",
  P1: "border-orange-200 bg-orange-50 text-orange-700",
  P2: "border-blue-200 bg-blue-50 text-blue-700",
  P3: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export function PriorityBadge({ priority }: { priority: keyof typeof priorityTone }) {
  return (
    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-bold ${priorityTone[priority]}`}>
      {priority}
    </span>
  );
}
