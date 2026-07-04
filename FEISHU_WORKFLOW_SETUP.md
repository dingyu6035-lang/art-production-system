# Feishu Workflow HTTP Automation

This project exposes one endpoint for Feishu Bitable automation:

```text
POST /api/feishu/workflow
```

## Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

```env
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxx
FEISHU_BASE_APP_TOKEN=xxxxxxxxxxxxxxxx
ART_WORKFLOW_SECRET=use-a-long-random-secret
```

`ART_WORKFLOW_SECRET` must also be sent by Feishu automation as a request header.

## Request Headers

```json
{
  "Content-Type": "application/json",
  "X-Art-Workflow-Secret": "same value as ART_WORKFLOW_SECRET"
}
```

You can also use:

```text
Authorization: Bearer <ART_WORKFLOW_SECRET>
```

## Events

### 1. New Requirement -> Create Task

Trigger in Feishu:

```text
01_需求提交台: when a record is created
```

HTTP body:

```json
{
  "event": "new_requirement_created",
  "record_id": "{{记录ID}}"
}
```

Effect:

- Writes a `TASK-0001` style task number back to `01_需求提交台`
- Creates the matching task in `02_任务工作台`
- Does not duplicate the task if it already exists

### 2. Task Ready For Review -> Create Review Record

Trigger in Feishu:

```text
02_任务工作台: when 任务状态 changes to 待审核
```

HTTP body:

```json
{
  "event": "task_ready_for_review",
  "record_id": "{{记录ID}}"
}
```

Effect:

- Creates or updates the matching record in `03_审核交付台`
- Updates the matching requirement status to `待审核`

### 3. Review Rejected -> Send Task Back

Trigger in Feishu:

```text
03_审核交付台: when 审核结果 is 驳回 or 需修改
```

HTTP body:

```json
{
  "event": "review_rejected",
  "record_id": "{{记录ID}}"
}
```

Effect:

- Updates the matching task in `02_任务工作台` back to `进行中`
- Copies the review reason/opinion into the task's risk/action fields
- Updates the review flow state to `返工中`

### 4. Accepted Reusable Asset -> Create Asset Draft

Trigger in Feishu:

```text
03_审核交付台: when 是否验收 = 是 and 是否可复用 = 是
```

HTTP body:

```json
{
  "event": "review_accepted_reusable",
  "record_id": "{{记录ID}}"
}
```

Effect:

- Creates a draft asset record in `04_美术资源库`
- Does not duplicate the asset if the task number already exists
- Updates the review next action

## Health Check

Open:

```text
https://<your-domain>/api/feishu/workflow
```

Expected:

```json
{
  "ok": true,
  "service": "feishu-art-workflow"
}
```
