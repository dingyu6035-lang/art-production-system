"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { EmptyState, LoadingSkeleton } from "@/components/state-views";
import { checkCriticalPages, checkSupabaseConnection, type HealthCheckResult } from "@/lib/system/health-check";

type PageStatus = Record<"dashboard" | "tasks" | "kanban" | "upload" | "analytics" | "debug", boolean>;

function StatusCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
        <span className={`font-semibold ${ok ? "text-emerald-800" : "text-red-800"}`}>{label}</span>
      </div>
    </div>
  );
}

export default function SystemCheckPage() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [pages, setPages] = useState<PageStatus | null>(null);

  useEffect(() => {
    async function runChecks() {
      setLoading(true);
      const [healthResult, pageResult] = await Promise.all([
        checkSupabaseConnection(),
        checkCriticalPages(),
      ]);
      setHealth(healthResult);
      setPages(pageResult);
      setLoading(false);
    }

    runChecks();
  }, []);

  const ready = Boolean(
    health?.status === "ok" &&
      pages &&
      Object.values(pages).every(Boolean)
  );

  return (
    <main className="min-h-screen bg-surface p-6">
      <section className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">系统上线检查</h1>
            <p className="mt-1 text-sm text-slate-500">验证 Supabase、关键页面和生产配置是否可上线。</p>
          </div>
          <Link className="button-primary" href="/dashboard">
            返回工作台
          </Link>
        </div>

        {loading && <LoadingSkeleton rows={6} />}

        {!loading && !health && <EmptyState title="检查未完成" description="请刷新页面重新运行上线检查。" />}

        {!loading && health && (
          <div className="grid gap-6">
            <section className={`panel p-5 ${ready ? "border-emerald-200" : "border-red-200"}`}>
              <div className="text-sm text-slate-500">上线状态</div>
              <div className={`mt-2 text-3xl font-bold ${ready ? "text-emerald-700" : "text-red-700"}`}>
                {ready ? "READY" : "NOT READY"}
              </div>
              <p className="mt-2 text-sm text-slate-500">{health.message}</p>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <StatusCard label="Supabase Auth" ok={health.auth} />
              <StatusCard label="Database Tables" ok={health.db} />
              <StatusCard label="Storage Bucket" ok={health.storage} />
            </section>

            <section className="panel p-5">
              <h2 className="mb-4 font-semibold text-slate-950">关键页面运行检查</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {pages &&
                  Object.entries(pages).map(([name, ok]) => (
                    <StatusCard key={name} label={`/${name}`} ok={ok} />
                  ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
