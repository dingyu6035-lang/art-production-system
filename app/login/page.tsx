"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
          });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("注册成功，请根据 Supabase 邮件确认设置完成验证。");
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden bg-white p-12 lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="text-lg font-bold text-primary">Art Production System</div>
          <h1 className="mt-20 max-w-xl text-5xl font-bold leading-tight text-slate-950">
            面向游戏美术团队的需求、看板与资源审核工作台
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
            类飞书多维表格、Jira 和看板结合的内部协作系统，统一项目、需求、提交文件与版本流转。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {["需求结构化", "资源可追踪", "权限可控"].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <form className="panel w-full max-w-md p-6" onSubmit={submit}>
          <div className="mb-6">
            <div className="text-2xl font-bold text-slate-950">{mode === "login" ? "登录" : "创建账号"}</div>
            <p className="mt-2 text-sm text-slate-500">使用 Supabase Auth 进入美术生产系统。</p>
          </div>
          <div className="space-y-4">
            {mode === "signup" && (
              <label className="block space-y-2">
                <span className="field-label">姓名</span>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
            )}
            <label className="block space-y-2">
              <span className="field-label">邮箱</span>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-9"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>
            <label className="block space-y-2">
              <span className="field-label">密码</span>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-9"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>
            </label>
          </div>
          {message && <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</div>}
          <button className="button-primary mt-6 w-full" disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
          <button
            type="button"
            className="mt-4 w-full text-center text-sm font-medium text-primary"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "没有账号？创建一个" : "已有账号？返回登录"}
          </button>
        </form>
      </section>
    </div>
  );
}
