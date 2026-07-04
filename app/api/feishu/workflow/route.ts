import { NextResponse } from "next/server";
import { runFeishuWorkflow, type WorkflowPayload } from "@/lib/feishu/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.ART_WORKFLOW_SECRET;
  if (!expected) return false;

  const headerSecret = request.headers.get("x-art-workflow-secret");
  const auth = request.headers.get("authorization");
  const bearerSecret = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  return headerSecret === expected || bearerSecret === expected;
}

function isWorkflowPayload(value: unknown): value is WorkflowPayload {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.event === "string" && typeof body.record_id === "string";
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "feishu-art-workflow",
    events: [
      "new_requirement_created",
      "task_ready_for_review",
      "review_rejected",
      "review_accepted_reusable",
    ],
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!isWorkflowPayload(payload)) {
    return NextResponse.json(
      { ok: false, error: "event and record_id are required" },
      { status: 400 },
    );
  }

  try {
    const result = await runFeishuWorkflow(payload);
    return NextResponse.json({ ok: true, event: payload.event, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[feishu-workflow]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
