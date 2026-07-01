import { createClient } from "@/lib/supabase/browser";

export type HealthCheckResult = {
  status: "ok" | "error";
  db: boolean;
  auth: boolean;
  storage: boolean;
  message: string;
};

export function hasRequiredEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function checkSupabaseConnection(): Promise<HealthCheckResult> {
  if (!hasRequiredEnv()) {
    return {
      status: "error",
      db: false,
      auth: false,
      storage: false,
      message: "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY。",
    };
  }

  try {
    const supabase = createClient();
    const authResult = await supabase.auth.getUser();

    const [tasksResult, projectsResult, assetsResult, storageResult] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("assets").select("id", { count: "exact", head: true }),
      supabase.storage.from("art-assets").list("", { limit: 1 }),
    ]);

    const db = !tasksResult.error && !projectsResult.error && !assetsResult.error;
    const auth = !authResult.error;
    const storage = !storageResult.error;
    const status = db && auth && storage ? "ok" : "error";

    return {
      status,
      db,
      auth,
      storage,
      message:
        status === "ok"
          ? "Supabase Auth、Database、Storage 均可访问。"
          : [
              tasksResult.error?.message,
              projectsResult.error?.message,
              assetsResult.error?.message,
              authResult.error?.message,
              storageResult.error?.message,
            ]
              .filter(Boolean)
              .join(" / ") || "Supabase 检测未完全通过。",
    };
  } catch (error) {
    return {
      status: "error",
      db: false,
      auth: false,
      storage: false,
      message: error instanceof Error ? error.message : "Supabase 连接检测失败。",
    };
  }
}

export async function checkCriticalPages() {
  const routes = ["/dashboard", "/tasks", "/kanban", "/upload", "/analytics", "/debug"] as const;
  const entries = await Promise.all(
    routes.map(async (route) => {
      try {
        const response = await fetch(route, { method: "GET", cache: "no-store" });
        return [route.slice(1), response.ok] as const;
      } catch {
        return [route.slice(1), false] as const;
      }
    })
  );

  return Object.fromEntries(entries) as Record<(typeof routes)[number] extends `/${infer Name}` ? Name : never, boolean>;
}
