export type UserRole = "planner" | "artist" | "pm" | "admin";
export type ProjectStatus = "active" | "paused" | "done";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type TaskType = "UI" | "character" | "scene" | "icon" | "VFX";
export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "review"
  | "revising"
  | "done";

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  owner_id: string | null;
  start_date: string | null;
  end_date: string | null;
  priority: Priority;
  description: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  project_id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  module: string[];
  style: string[];
  content: string[];
  assignee_id: string | null;
  reviewer_id: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_days: number | null;
  created_at: string;
};

export type Asset = {
  id: string;
  task_id: string;
  uploader_id: string;
  file_url: string;
  file_type: string | null;
  version: string;
  is_final: boolean;
  comment: string | null;
  created_at: string;
};

export type TaskWithRelations = Task & {
  projects?: Pick<Project, "id" | "name" | "priority" | "status"> | null;
  assignee?: Pick<UserProfile, "id" | "name" | "email" | "role"> | null;
  reviewer?: Pick<UserProfile, "id" | "name" | "email" | "role"> | null;
};

export type AssetWithRelations = Asset & {
  tasks?: Pick<Task, "id" | "title" | "project_id"> | null;
  uploader?: Pick<UserProfile, "id" | "name" | "email"> | null;
};
