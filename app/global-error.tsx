"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "sans-serif" }}>
          <section style={{ maxWidth: 520, border: "1px solid #e5e7eb", borderRadius: 16, padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>系统暂时不可用</h1>
            <p style={{ color: "#64748b", lineHeight: 1.7 }}>
              已捕获全局异常，系统没有白屏。请重试，或回到工作台。
            </p>
            <p style={{ color: "#64748b", fontSize: 12 }}>{error.message || "Unknown error"}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button onClick={reset} style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff" }}>
                重试
              </button>
              <a href="/dashboard" style={{ height: 40, padding: "0 16px", borderRadius: 12, background: "#2563eb", color: "#fff", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                返回工作台
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
