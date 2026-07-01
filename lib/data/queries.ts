import type { AssetWithRelations, Project, TaskWithRelations, UserProfile } from "@/types/database";

export const taskSelect = `
  *,
  projects!tasks_project_id_fkey(id,name,priority,status),
  assignee:users!tasks_assignee_id_fkey(id,name,email,role),
  reviewer:users!tasks_reviewer_id_fkey(id,name,email,role)
`;

export const assetSelect = `
  *,
  tasks!assets_task_id_fkey(id,title,project_id),
  uploader:users!assets_uploader_id_fkey(id,name,email)
`;

export type AppData = {
  projects: Project[];
  tasks: TaskWithRelations[];
  users: UserProfile[];
  assets: AssetWithRelations[];
};
