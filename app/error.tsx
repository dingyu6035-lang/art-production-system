"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <section className="panel max-w-lg p-6">
        <h1 className="text-xl font-bold text-slate-950">页面暂时不可用</h1>
        <p className="mt-2 text-sm text-slate-500">
          系统已拦截异常，页面不会白屏。可以重试，或返回工作台继续操作。
        </p>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          {error.message || "Unknown error"}
        </p>
        <div className="mt-5 flex gap-3">
          <button className="button-secondary" onClick={reset}>
            重试
          </button>
          <Link className="button-primary" href="/dashboard">
            返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
