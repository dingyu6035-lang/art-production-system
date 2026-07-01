"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { MultiSelect } from "@/components/multi-select";
import { CONTENT_OPTIONS, MODULE_OPTIONS, PRIORITIES, STYLE_OPTIONS, TASK_TYPES } from "@/lib/constants";
import { useAppData } from "@/lib/hooks/use-app-data";
import { validateTask } from "@/lib/rules/task-rules";
import { createClient } from "@/lib/supabase/browser";
import type { Priority, TaskType } from "@/types/database";

export default function NewTaskPage() {
  const router = useRouter();
  const { projects, users, loading } = useAppData();
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ruleErrors, setRuleErrors] = useState<string[]>([]);
  const [form, setForm] = useState({
    project_id: "",
    title: "",
    type: "UI" as TaskType,
    module: [] as string[],
    style: [] as string[],
    content: [] as string[],
    priority: "P2" as Priority,
    assignee_id: "",
    reviewer_id: "",
    start_date: "",
    end_date: "",
    estimated_days: 1,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateTask(form);
    setRuleErrors(result.errors);

    if (!result.valid) {
      setAdvancedOpen(true);
      return;
    }

    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase.from("tasks").insert({
      ...form,
      reviewer_id: form.reviewer_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      estimated_days: Number(form.estimated_days) || null,
    });

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }

    router.push("/tasks");
  }

  return (
    <>
      <PageHeader
        title="创建美术需求"
        description="默认只填写最关键的 5 个字段，策划可以在 30 秒内完成建单。"
      />

      <form className="panel max-w-5xl p-5" onSubmit={submit}>
        <div className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
          必填字段：项目、任务标题、类型、优先级、负责人。更多交付细节可在高级设置里补充。
        </div>

        {ruleErrors.length > 0 && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="mb-2 font-semibold">需求不符合生产规则，无法提交：</div>
            <ul className="space-y-1">
              {ruleErrors.map((error) => (
                <li key={error}>- {error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="field-label">项目</span>
            <select
              className="input"
              value={form.project_id}
              onChange={(event) => setForm({ ...form, project_id: event.target.value })}
              required
              disabled={loading || saving}
            >
              <option value="">请选择项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="field-label">任务标题</span>
            <input
              className="input"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="例如：商城首页活动 Banner"
              required
              disabled={saving}
            />
          </label>

          <label className="space-y-2">
            <span className="field-label">类型</span>
            <select
              className="input"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as TaskType })}
              disabled={saving}
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="field-label">优先级</span>
            <select
              className="input"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
              disabled={saving}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="field-label">负责人</span>
            <select
              className="input"
              value={form.assignee_id}
              onChange={(event) => setForm({ ...form, assignee_id: event.target.value })}
              required
              disabled={loading || saving}
            >
              <option value="">请选择负责人</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="my-6 border-t border-slate-200 pt-4">
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-slate-700"
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            高级设置
          </button>
        </div>

        {advancedOpen && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <span className="field-label">模块</span>
              <MultiSelect options={MODULE_OPTIONS} value={form.module} onChange={(module) => setForm({ ...form, module })} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <span className="field-label">风格</span>
              <MultiSelect options={STYLE_OPTIONS} value={form.style} onChange={(style) => setForm({ ...form, style })} />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <span className="field-label">内容</span>
              <MultiSelect options={CONTENT_OPTIONS} value={form.content} onChange={(content) => setForm({ ...form, content })} />
            </div>

            <label className="space-y-2">
              <span className="field-label">验收人</span>
              <select
                className="input"
                value={form.reviewer_id}
                onChange={(event) => setForm({ ...form, reviewer_id: event.target.value })}
                disabled={saving}
              >
                <option value="">未指定</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="field-label">预计工期</span>
              <input
                className="input"
                type="number"
                min={1}
                value={form.estimated_days}
                onChange={(event) => setForm({ ...form, estimated_days: Number(event.target.value) })}
                disabled={saving}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">开始时间</span>
              <input
                className="input"
                type="date"
                value={form.start_date}
                onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                disabled={saving}
              />
            </label>

            <label className="space-y-2">
              <span className="field-label">结束时间</span>
              <input
                className="input"
                type="date"
                value={form.end_date}
                onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                disabled={saving}
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button className="button-primary min-w-32" disabled={saving || loading}>
            {saving ? "创建中..." : "创建需求"}
          </button>
        </div>
      </form>
    </>
  );
}
