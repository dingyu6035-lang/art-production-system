create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'artist' check (role in ('planner', 'artist', 'pm', 'admin')),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  owner_id uuid references public.users(id) on delete set null,
  start_date date,
  end_date date,
  priority text not null default 'P2' check (priority in ('P0', 'P1', 'P2', 'P3')),
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  type text not null check (type in ('UI', 'character', 'scene', 'icon', 'VFX')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'review', 'revising', 'done')),
  priority text not null default 'P2' check (priority in ('P0', 'P1', 'P2', 'P3')),
  module text[] not null default '{}',
  style text[] not null default '{}',
  content text[] not null default '{}',
  assignee_id uuid references public.users(id) on delete set null,
  reviewer_id uuid references public.users(id) on delete set null,
  start_date date,
  end_date date,
  estimated_days int check (estimated_days is null or estimated_days > 0),
  created_at timestamp with time zone not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploader_id uuid not null references public.users(id) on delete cascade,
  file_url text not null,
  file_type text,
  version text not null,
  is_final boolean not null default false,
  comment text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_projects_owner_id on public.projects(owner_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_assignee_id on public.tasks(assignee_id);
create index if not exists idx_tasks_reviewer_id on public.tasks(reviewer_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_priority on public.tasks(priority);
create index if not exists idx_assets_task_id on public.assets(task_id);
create index if not exists idx_assets_uploader_id on public.assets(uploader_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    'artist'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(public.users.name, excluded.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.has_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any(allowed), false);
$$;

create or replace function public.enforce_task_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status and not public.is_admin() then
    if not (
      (old.status = 'not_started' and new.status = 'in_progress') or
      (old.status = 'in_progress' and new.status = 'review') or
      (old.status = 'review' and new.status in ('done', 'revising')) or
      (old.status = 'revising' and new.status = 'review')
    ) then
      raise exception 'Invalid task status transition from % to %', old.status, new.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists task_status_transition on public.tasks;
create trigger task_status_transition
before update on public.tasks
for each row execute function public.enforce_task_status_transition();

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.assets enable row level security;

drop policy if exists "users_select_authenticated" on public.users;
create policy "users_select_authenticated"
on public.users for select
to authenticated
using (true);

drop policy if exists "users_update_self_or_admin" on public.users;
create policy "users_update_self_or_admin"
on public.users for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "projects_select_authenticated" on public.projects;
create policy "projects_select_authenticated"
on public.projects for select
to authenticated
using (true);

drop policy if exists "projects_insert_pm_planner_admin" on public.projects;
create policy "projects_insert_pm_planner_admin"
on public.projects for insert
to authenticated
with check (public.has_role(array['planner', 'pm', 'admin']));

drop policy if exists "projects_update_pm_owner_admin" on public.projects;
create policy "projects_update_pm_owner_admin"
on public.projects for update
to authenticated
using (public.has_role(array['pm', 'admin']) or owner_id = auth.uid())
with check (public.has_role(array['pm', 'admin']) or owner_id = auth.uid());

drop policy if exists "projects_delete_admin" on public.projects;
create policy "projects_delete_admin"
on public.projects for delete
to authenticated
using (public.is_admin());

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
on public.tasks for select
to authenticated
using (true);

drop policy if exists "tasks_insert_planner_admin" on public.tasks;
create policy "tasks_insert_planner_admin"
on public.tasks for insert
to authenticated
with check (public.has_role(array['planner', 'admin']));

drop policy if exists "tasks_update_planner_pm_admin" on public.tasks;
create policy "tasks_update_planner_pm_admin"
on public.tasks for update
to authenticated
using (public.has_role(array['planner', 'pm', 'admin']))
with check (public.has_role(array['planner', 'pm', 'admin']));

drop policy if exists "tasks_delete_admin" on public.tasks;
create policy "tasks_delete_admin"
on public.tasks for delete
to authenticated
using (public.is_admin());

drop policy if exists "assets_select_authenticated" on public.assets;
create policy "assets_select_authenticated"
on public.assets for select
to authenticated
using (true);

drop policy if exists "assets_insert_artist_pm_admin" on public.assets;
create policy "assets_insert_artist_pm_admin"
on public.assets for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and public.has_role(array['artist', 'pm', 'admin'])
);

drop policy if exists "assets_update_pm_admin" on public.assets;
create policy "assets_update_pm_admin"
on public.assets for update
to authenticated
using (public.has_role(array['pm', 'admin']))
with check (public.has_role(array['pm', 'admin']));

drop policy if exists "assets_delete_admin" on public.assets;
create policy "assets_delete_admin"
on public.assets for delete
to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('art-assets', 'art-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "art_assets_select_authenticated" on storage.objects;
create policy "art_assets_select_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'art-assets');

drop policy if exists "art_assets_insert_uploader_roles" on storage.objects;
create policy "art_assets_insert_uploader_roles"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'art-assets'
  and public.has_role(array['artist', 'pm', 'admin'])
);

drop policy if exists "art_assets_update_pm_admin" on storage.objects;
create policy "art_assets_update_pm_admin"
on storage.objects for update
to authenticated
using (bucket_id = 'art-assets' and public.has_role(array['pm', 'admin']))
with check (bucket_id = 'art-assets' and public.has_role(array['pm', 'admin']));

drop policy if exists "art_assets_delete_admin" on storage.objects;
create policy "art_assets_delete_admin"
on storage.objects for delete
to authenticated
using (bucket_id = 'art-assets' and public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.projects;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end;
$$;
