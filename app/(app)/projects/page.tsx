"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, ProjectStatusBadge } from "@/components/status-badge";
import { PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import { cn, formatDate } from "@/lib/utils";
import { useAppData } from "@/lib/hooks/use-app-data";
import type { Priority, ProjectStatus } from "@/types/database";

export default function ProjectsPage() {
  const { projects, users, currentUser, loading, error, reload } = useAppData();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    status: "active" as ProjectStatus,
    owner_id: "",
    start_date: "",
    end_date: "",
    priority: "P2" as Priority,
    description: "",
  });

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch =
        !normalizedSearch ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.description?.toLowerCase().includes(normalizedSearch);
      return matchesSearch && (statusFilter === "all" || project.status === statusFilter);
    });
  }, [projects, statusFilter, search]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("projects").insert({
      ...form,
      owner_id: form.owner_id || currentUser?.id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
    setSaving(false);
    if (insertError) {
      alert(insertError.message);
      return;
    }
    setShowForm(false);
    setForm({ name: "", status: "active", owner_id: "", start_date: "", end_date: "", priority: "P2", description: "" });
    reload();
  }

  return (
    <>
      <PageHeader
        title="项目管理"
        description="管理美术生产项目、负责人、周期和优先级。"
        action={
          <button className="button-primary" onClick={() => setShowForm((value) => !value)}>
            <Plus className="h-4 w-4" />
            创建项目
          </button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            className="h-10 flex-1 bg-transparent text-sm outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索项目名称或描述"
          />
        </div>
        <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">全部状态</option>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form className="panel mb-6 grid gap-4 p-5 md:grid-cols-2" onSubmit={createProject}>
          <label className="space-y-2">
            <span className="field-label">项目名称</span>
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required disabled={saving} />
          </label>
          <label className="space-y-2">
            <span className="field-label">负责人</span>
            <select className="input" value={form.owner_id} onChange={(event) => setForm({ ...form, owner_id: event.target.value })} disabled={saving}>
              <option value="">默认当前用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="field-label">状态</span>
            <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })} disabled={saving}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="field-label">优先级</span>
            <select className="input" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })} disabled={saving}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="field-label">开始时间</span>
            <input className="input" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} disabled={saving} />
          </label>
          <label className="space-y-2">
            <span className="field-label">结束时间</span>
            <input className="input" type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} disabled={saving} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="field-label">描述</span>
            <textarea className="textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} disabled={saving} />
          </label>
          <div className="md:col-span-2">
            <button className="button-primary" disabled={saving}>{saving ? "保存中..." : "保存项目"}</button>
          </div>
        </form>
      )}

      <div className="panel overflow-hidden">
        {loading && <div className="p-6 text-sm text-slate-500">加载中...</div>}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">项目</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">优先级</th>
              <th className="px-4 py-3">开始</th>
              <th className="px-4 py-3">结束</th>
              <th className="px-4 py-3">描述</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((project) => (
              <tr key={project.id} className={cn("bg-white", project.priority === "P0" && "border-l-4 border-l-red-500")}>
                <td className="px-4 py-3 font-semibold text-slate-900">{project.name}</td>
                <td className="px-4 py-3"><ProjectStatusBadge status={project.status} /></td>
                <td className="px-4 py-3"><PriorityBadge priority={project.priority} /></td>
                <td className="px-4 py-3 text-slate-600">{formatDate(project.start_date)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(project.end_date)}</td>
                <td className="px-4 py-3 text-slate-500">{project.description || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="p-6 text-sm text-slate-500">没有匹配的项目。</div>}
      </div>
    </>
  );
}
