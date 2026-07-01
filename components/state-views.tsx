import Link from "next/link";

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 h-5 w-40 animate-pulse rounded-lg bg-slate-200" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title = "暂无数据",
  description = "当前没有需要显示的内容。",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="panel p-6 text-sm">
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-slate-500">{description}</div>
    </div>
  );
}

export function ErrorState({
  message = "数据加载失败，请稍后重试。",
  reset,
}: {
  message?: string;
  reset?: () => void;
}) {
  return (
    <div className="panel border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <div className="font-semibold">页面遇到问题</div>
      <div className="mt-1">{message}</div>
      <div className="mt-4 flex gap-2">
        {reset && (
          <button className="button-secondary bg-white" onClick={reset}>
            重试
          </button>
        )}
        <Link className="button-primary" href="/dashboard">
          返回工作台
        </Link>
      </div>
    </div>
  );
}
