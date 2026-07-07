-- Loop Engineering System schema. All tables prefixed loop_.
-- Public dashboard reads via anon SELECT; writes only via service role (RLS bypass).

create table public.loop_state (
  id text primary key default 'main',
  phase text not null default 'idle' check (phase in ('idle','observing','scoring','learning','proposing','testing','activating','monitoring')),
  current_task_id text,
  active_proposal_id text,
  last_score int,
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.loop_iterations (
  id uuid primary key default gen_random_uuid(),
  task_id text not null unique,
  source text not null default 'hermes',
  session_key text,
  ts timestamptz not null default now(),
  user_request text,
  constraints jsonb not null default '[]'::jsonb,
  plan text,
  tools_used jsonb not null default '[]'::jsonb,
  skills_loaded jsonb not null default '[]'::jsonb,
  mcps_used jsonb not null default '[]'::jsonb,
  output_summary text,
  validation jsonb not null default '{}'::jsonb,
  mistakes jsonb not null default '[]'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  approval_issues jsonb not null default '[]'::jsonb,
  token_usage bigint default 0,
  turn_count int default 0,
  duration_seconds numeric default 0,
  created_at timestamptz not null default now()
);
create index loop_iterations_ts_idx on public.loop_iterations (ts desc);

create table public.loop_scores (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.loop_iterations(task_id) on delete cascade,
  total int not null check (total between 0 and 100),
  breakdown jsonb not null default '{}'::jsonb,
  caps_applied jsonb not null default '[]'::jsonb,
  judge_model text,
  rationale text,
  created_at timestamptz not null default now()
);
create index loop_scores_task_idx on public.loop_scores (task_id);
create index loop_scores_created_idx on public.loop_scores (created_at desc);

create table public.loop_lessons (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null unique,
  source_task_id text,
  lesson_type text not null check (lesson_type in ('preference','procedure','pitfall','optimization')),
  content text not null,
  evidence text,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  target text not null check (target in ('memory','skill','prompt','config')),
  applied boolean not null default false,
  created_at timestamptz not null default now()
);
create index loop_lessons_created_idx on public.loop_lessons (created_at desc);

create table public.loop_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_id text not null unique,
  source_lessons jsonb not null default '[]'::jsonb,
  type text not null check (type in ('memory','skill','prompt','config','mcp')),
  target text not null,
  old_value text,
  new_value text,
  rationale text,
  risk_level text not null default 'low' check (risk_level in ('low','medium','high')),
  eval_required boolean not null default true,
  status text not null default 'proposed' check (status in ('proposed','testing','pending_approval','active','rejected','rolled_back')),
  eval_summary jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now()
);
create index loop_proposals_status_idx on public.loop_proposals (status, created_at desc);

create table public.loop_eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  eval_name text not null,
  score int not null check (score between 0 and 100),
  passed boolean not null,
  baseline_score int,
  proposal_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index loop_eval_results_run_idx on public.loop_eval_results (run_id);
create index loop_eval_results_created_idx on public.loop_eval_results (created_at desc);

create table public.loop_failure_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null unique,
  description text not null,
  frequency int not null default 1,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  examples jsonb not null default '[]'::jsonb,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.loop_activations (
  id uuid primary key default gen_random_uuid(),
  proposal_id text not null,
  action text not null check (action in ('activated','rolled_back','rejected','pending_approval','approved')),
  reason text,
  snapshot_path text,
  created_at timestamptz not null default now()
);
create index loop_activations_created_idx on public.loop_activations (created_at desc);

insert into public.loop_state (id, phase) values ('main', 'idle');

-- RLS: anon may read, nobody but service role may write
alter table public.loop_state enable row level security;
alter table public.loop_iterations enable row level security;
alter table public.loop_scores enable row level security;
alter table public.loop_lessons enable row level security;
alter table public.loop_proposals enable row level security;
alter table public.loop_eval_results enable row level security;
alter table public.loop_failure_patterns enable row level security;
alter table public.loop_activations enable row level security;

create policy "loop_state_public_read" on public.loop_state for select using (true);
create policy "loop_iterations_public_read" on public.loop_iterations for select using (true);
create policy "loop_scores_public_read" on public.loop_scores for select using (true);
create policy "loop_lessons_public_read" on public.loop_lessons for select using (true);
create policy "loop_proposals_public_read" on public.loop_proposals for select using (true);
create policy "loop_eval_results_public_read" on public.loop_eval_results for select using (true);
create policy "loop_failure_patterns_public_read" on public.loop_failure_patterns for select using (true);
create policy "loop_activations_public_read" on public.loop_activations for select using (true);
