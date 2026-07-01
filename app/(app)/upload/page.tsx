"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/state-views";
import { createClient } from "@/lib/supabase/browser";
import { useAppData } from "@/lib/hooks/use-app-data";
import { cn } from "@/lib/utils";

const versions = ["v1", "v2", "v3"];

function Step({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", active ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500")}>
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold", done ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : index}
      </span>
      {label}
    </div>
  );
}

export default function UploadPage() {
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("task") || "";
  const { tasks, currentUser, loading, error, reload } = useAppData();
  const [taskId, setTaskId] = useState(initialTaskId);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("v1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialTaskId) setTaskId(initialTaskId);
  }, [initialTaskId]);

  const selectedTask = useMemo(() => tasks.find((task) => task.id === taskId), [tasks, taskId]);
  const currentStep = !taskId ? 1 : !file ? 2 : 3;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !selectedTask || !currentUser) return;

    setSaving(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${selectedTask.project_id}/${selectedTask.id}/${version}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("art-assets").upload(path, file, { upsert: false });
    if (uploadError) {
      setSaving(false);
      alert(uploadError.message);
      return;
    }

    const { data: publicUrl } = supabase.storage.from("art-assets").getPublicUrl(path);
    const { error } = await supabase.from("assets").insert({
      task_id: selectedTask.id,
      uploader_id: currentUser.id,
      file_url: publicUrl.publicUrl,
      file_type: file.type || "unknown",
      version,
      is_final: false,
      comment: null,
    });

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }

    setFile(null);
    reload();
  }

  return (
    <>
      <PageHeader title="上传资源" description="选任务、传文件、填版本。" />
      {loading && <LoadingSkeleton rows={3} />}
      {error && <ErrorState message={error} />}
      {!loading && !error && tasks.length === 0 && <EmptyState title="暂无任务" description="需要先创建任务，才能上传资源。" />}

      {!loading && !error && tasks.length > 0 && (
      <>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <Step index={1} label="选任务" active={currentStep === 1} done={Boolean(taskId)} />
        <Step index={2} label="上传文件" active={currentStep === 2} done={Boolean(file)} />
        <Step index={3} label="版本号" active={currentStep === 3} done={Boolean(version)} />
      </div>

      <form className="panel grid gap-5 p-5 lg:grid-cols-3" onSubmit={submit}>
        <label className="space-y-2">
          <span className="field-label">Step 1：任务</span>
          <select className="input" value={taskId} onChange={(event) => setTaskId(event.target.value)} required disabled={saving}>
            <option value="">请选择任务</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} / {task.projects?.name || "未关联项目"}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="field-label">Step 2：文件</span>
          <input className="input pt-2" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} required disabled={!taskId || saving} />
        </label>

        <label className="space-y-2">
          <span className="field-label">Step 3：版本</span>
          <select className="input" value={version} onChange={(event) => setVersion(event.target.value)} required disabled={saving}>
            {versions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <div className="lg:col-span-3">
          <button className="button-primary" disabled={saving || !file || !taskId}>
            <UploadCloud className="h-4 w-4" />
            {saving ? "提交中..." : "提交"}
          </button>
        </div>
      </form>
      </>
      )}
    </>
  );
}
