# Art Production System

美术需求管理系统，使用 Next.js 14、React、TypeScript、TailwindCSS、Supabase Auth/PostgreSQL/Storage 构建，可部署到 Vercel。

## 功能

- 登录与注册：Supabase Auth
- 项目管理：项目列表、筛选、创建项目
- 美术需求：结构化创建表单、表格筛选
- 看板：`not_started -> in_progress -> review -> done` 拖拽流转
- 我的任务：只展示当前用户负责的任务
- 资源提交：项目过滤任务、上传到 Supabase Storage、记录版本
- 权限：Supabase RLS 按 `planner / artist / pm / admin` 控制
- Realtime：项目和任务列表自动刷新

## 文件结构

```text
app/
  (app)/
    kanban/page.tsx
    layout.tsx
    my/page.tsx
    projects/page.tsx
    tasks/page.tsx
    tasks/new/page.tsx
    upload/page.tsx
  login/page.tsx
  globals.css
  layout.tsx
components/
  app-shell.tsx
  auth-guard.tsx
  multi-select.tsx
  page-header.tsx
  status-badge.tsx
lib/
  data/queries.ts
  hooks/use-app-data.ts
  supabase/browser.ts
  constants.ts
  utils.ts
supabase/
  schema.sql
types/
  database.ts
```

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
cp .env.example .env.local
```

3. 填写 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. 启动：

```bash
npm run dev
```

5. 构建验证：

```bash
npm run build
```

## Supabase 初始化

1. 在 Supabase 创建新项目。
2. 打开 SQL Editor。
3. 执行 `supabase/schema.sql` 的全部内容。
4. 打开 Authentication，按团队需要配置邮箱确认策略。
5. 首个用户注册后默认是 `artist`。需要管理员时，在 SQL Editor 执行：

```sql
update public.users
set role = 'admin'
where email = 'your-email@example.com';
```

6. `art-assets` bucket 会由 SQL 自动创建，上传路径为：

```text
project_id/task_id/version/file
```

## Vercel 部署

1. 将项目推送到 GitHub。
2. 在 Vercel 导入仓库。
3. Framework Preset 选择 Next.js。
4. 添加环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. 部署。

部署后，先注册一个用户，再通过 Supabase SQL 将该用户提升为 `admin` 或 `planner`，即可创建项目和需求。
