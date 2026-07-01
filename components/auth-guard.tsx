"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type { UserProfile } from "@/types/database";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSession() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }

        const { data: found } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .single();

        setProfile(found as UserProfile | null);
        setReady(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "登录状态检查失败");
        setReady(true);
      }
    }

    loadSession();
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-sm text-slate-500">
        正在进入系统...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="panel max-w-lg p-6 text-sm">
          <div className="text-lg font-bold text-slate-950">系统配置未就绪</div>
          <p className="mt-2 text-slate-500">
            请检查 Supabase 环境变量是否已在 `.env.local` 或 Vercel 中配置。
          </p>
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
