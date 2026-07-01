import Link from "next/link";

const envItems = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    description: "Supabase 项目 URL，例如 https://xxxx.supabase.co",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    description: "Supabase anon public key，用于前端访问 Auth / DB / Storage。",
  },
];

export default function SetupCheckPage() {
  return (
    <main className="min-h-screen bg-surface p-6">
      <section className="panel mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold text-slate-950">上线配置检查</h1>
        <p className="mt-2 text-sm text-slate-500">
          部署前请确保 Vercel 环境变量和本地 `.env.local` 已正确配置。
        </p>
        <div className="mt-6 space-y-3">
          {envItems.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="font-mono text-sm font-semibold text-slate-950">{item.key}</div>
              <div className="mt-1 text-sm text-slate-500">{item.description}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <Link className="button-primary" href="/system-check">
            运行系统检查
          </Link>
          <Link className="button-secondary" href="/dashboard">
            返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
