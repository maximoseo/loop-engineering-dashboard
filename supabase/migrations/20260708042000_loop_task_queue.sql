-- Persistent Loop Engineering task queue and event timeline.
-- Public dashboard can read task summaries; server-side service role writes/updates rows.

create table if not exists public.loop_task_handoffs (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  task text not null check (char_length(task) between 10 and 4000),
  kind text not null default 'agent-run' check (kind in ('agent-run','project','debug','dashboard','proposal')),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  destination text not null default 'auto' check (destination in ('auto','telegram','worker-webhook')),
  resolved_destination text not null default 'pending' check (resolved_destination in ('pending','telegram','worker-webhook','blocked','failed')),
  status text not null default 'queued' check (status in ('queued','delivered','accepted','running','needs_review','done','failed','blocked_config','archived')),
  delivery_message text,
  process jsonb not null default '[]'::jsonb,
  result_summary text,
  telegram_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  error text
);

create index if not exists loop_task_handoffs_created_at_idx on public.loop_task_handoffs (created_at desc);
create index if not exists loop_task_handoffs_status_idx on public.loop_task_handoffs (status, created_at desc);
create index if not exists loop_task_handoffs_priority_idx on public.loop_task_handoffs (priority, created_at desc);

create table if not exists public.loop_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.loop_task_handoffs(task_id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists loop_task_events_task_id_idx on public.loop_task_events (task_id, created_at asc);
create index if not exists loop_task_events_created_at_idx on public.loop_task_events (created_at desc);

create or replace function public.set_loop_task_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_loop_task_handoffs_updated_at on public.loop_task_handoffs;
create trigger set_loop_task_handoffs_updated_at
before update on public.loop_task_handoffs
for each row execute function public.set_loop_task_updated_at();

alter table public.loop_task_handoffs enable row level security;
alter table public.loop_task_events enable row level security;

drop policy if exists "loop_task_handoffs_public_read" on public.loop_task_handoffs;
create policy "loop_task_handoffs_public_read" on public.loop_task_handoffs for select using (true);

drop policy if exists "loop_task_events_public_read" on public.loop_task_events;
create policy "loop_task_events_public_read" on public.loop_task_events for select using (true);
