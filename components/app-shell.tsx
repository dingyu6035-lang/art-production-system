"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const nav = [{ href: "/dashboard", label: "工作台", icon: Home }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-surface">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white md:block">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <div>
            <div className="text-base font-bold text-slate-950">Art Production</div>
            <div className="text-xs text-slate-500">生产工作台</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100",
                  active && "bg-primary-soft text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input className="h-10 flex-1 bg-transparent text-sm outline-none" placeholder="搜索任务" />
          </div>
          <button className="button-secondary ml-4" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
