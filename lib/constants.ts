import type { Priority, ProjectStatus, TaskStatus, TaskType, UserRole } from "@/types/database";

export const ROLES: UserRole[] = ["planner", "artist", "pm", "admin"];
export const PROJECT_STATUSES: ProjectStatus[] = ["active", "paused", "done"];
export const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
export const TASK_TYPES: TaskType[] = ["UI", "character", "scene", "icon", "VFX"];
export const TASK_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "review",
  "revising",
  "done",
];

export const KANBAN_STATUSES: TaskStatus[] = [
  "not_started",
  "in_progress",
  "review",
  "done",
];

export const MODULE_OPTIONS = [
  "UI",
  "battle",
  "shop",
  "bag",
  "quest",
  "guild",
  "character",
  "map",
  "event",
  "system",
];

export const STYLE_OPTIONS = [
  "sci-fi",
  "fantasy",
  "casual",
  "realistic",
  "anime",
  "low-poly",
  "dark",
  "bright",
  "premium",
  "minimal",
];

export const CONTENT_OPTIONS = [
  "concept",
  "wireframe",
  "final art",
  "animation",
  "export files",
  "source file",
  "icon set",
  "layout",
  "review revision",
  "delivery package",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  review: "审核中",
  revising: "返修中",
  done: "已完成",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "进行中",
  paused: "暂停",
  done: "完成",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  UI: "UI",
  character: "角色",
  scene: "场景",
  icon: "图标",
  VFX: "动效",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  planner: "策划",
  artist: "美术",
  pm: "项目经理",
  admin: "管理员",
};

export const VALID_STATUS_MOVES: Record<TaskStatus, TaskStatus[]> = {
  not_started: ["in_progress"],
  in_progress: ["review"],
  review: ["done", "revising"],
  revising: ["review"],
  done: [],
};
