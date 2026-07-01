"use client";

import { useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/browser";
import { taskSelect } from "@/lib/data/queries";
import type { Project, TaskStatus, TaskWithRelations, UserProfile } from "@/types/database";

export function useAppData() {
  const fetchAppData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();

      const [projectsResult, tasksResult, usersResult] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select(taskSelect).order("created_at", { ascending: false }),
        supabase.from("users").select("*").order("created_at", { ascending: false }),
      ]);

      const firstError = projectsResult.error || tasksResult.error || usersResult.error;
      if (firstError) throw firstError;

      const users = (usersResult.data || []) as UserProfile[];
      return {
        projects: (projectsResult.data || []) as Project[],
        tasks: (tasksResult.data || []) as TaskWithRelations[],
        users,
        currentUser: users.find((user) => user.id === auth.user?.id) || null,
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error("Supabase 数据读取失败");
    }
  }, []);

  const { data, error, isLoading, mutate } = useSWR("app-data", fetchAppData, {
    revalidateOnFocus: false,
  });

  const canMoveTaskStatus = useCallback(async (task: TaskWithRelations, nextStatus: TaskStatus) => {
    if (nextStatus !== "review") {
      return { allowed: true, errors: [] as string[] };
    }

    const errors: string[] = [];
    if (!task.assignee_id) errors.push("进入审核前必须指定负责人");
    if (!task.reviewer_id) errors.push("进入审核前必须指定验收人");

    try {
      const supabase = createClient();
      const { count, error: countError } = await supabase
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("task_id", task.id);

      if (countError) errors.push(countError.message);
      if (!count) errors.push("进入审核前至少需要提交 1 个资源版本");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "资源检查失败");
    }

    return { allowed: errors.length === 0, errors };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("app-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => mutate())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => mutate())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  return useMemo(
    () => ({
      projects: data?.projects || [],
      tasks: data?.tasks || [],
      users: data?.users || [],
      currentUser: data?.currentUser || null,
      loading: isLoading,
      error: error?.message || "",
      reload: mutate,
      canMoveTaskStatus,
    }),
    [canMoveTaskStatus, data, error?.message, isLoading, mutate]
  );
}
