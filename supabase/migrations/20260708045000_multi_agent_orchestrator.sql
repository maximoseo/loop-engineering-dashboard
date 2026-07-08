-- Multi-agent orchestration cockpit schema.
-- Dashboard is the control plane; workers execute through leased assignments.

create table if not exists public.loop_projects (
  id uuid primary key default gen_random_uuid(),
  project_id text not null unique,
  name text not null,
  objective text not null,
  scope jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '[]'::jsonb,
  success_criteria jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused','done','failed','archived')),
  created_by text not null default 'dashboard',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loop_projects_status_idx on public.loop_projects (status, created_at desc);

create table if not exists public.loop_model_profiles (
  id uuid primary key default gen_random_uuid(),
  model_profile_id text not null unique,
  label text not null,
  provider text not null,
  model text not null,
  purpose text not null,
  cost_tier text not null default 'medium' check (cost_tier in ('low','medium','high')),
  latency_tier text not null default 'normal' check (latency_tier in ('fast','normal','slow')),
  capabilities jsonb not null default '{}'::jsonb,
  fallback_profile_ids jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loop_agent_registry (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null unique,
  name text not null,
  type text not null check (type in ('hermes','claude_code','codex','opencode','seo_bot','qa_bot','browser_bot','security_bot','custom_webhook')),
  role text not null,
  capabilities jsonb not null default '[]'::jsonb,
  allowed_tools jsonb not null default '[]'::jsonb,
  default_model_profile_id text references public.loop_model_profiles(model_profile_id),
  status text not null default 'online' check (status in ('online','offline','degraded','disabled')),
  last_heartbeat timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loop_orchestrator_runs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null unique,
  project_id text not null references public.loop_projects(project_id) on delete cascade,
  mode text not null default 'parallel_specialists' check (mode in ('lead_agent','parallel_specialists','debate','pipeline','swarm_verify')),
  status text not null default 'queued' check (status in ('draft','queued','planning','dispatching','running','verifying','needs_review','done','failed','cancelled')),
  strategy jsonb not null default '{}'::jsonb,
  budget jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loop_orchestrator_runs_project_idx on public.loop_orchestrator_runs (project_id, created_at desc);
create index if not exists loop_orchestrator_runs_status_idx on public.loop_orchestrator_runs (status, created_at desc);

create table if not exists public.loop_agent_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_id text not null unique,
  run_id text not null references public.loop_orchestrator_runs(run_id) on delete cascade,
  project_id text not null references public.loop_projects(project_id) on delete cascade,
  parent_assignment_id text,
  agent_id text not null references public.loop_agent_registry(agent_id),
  model_profile_id text references public.loop_model_profiles(model_profile_id),
  status text not null default 'queued' check (status in ('queued','leased','running','blocked','needs_review','done','failed','cancelled')),
  lease_owner text,
  lease_expires_at timestamptz,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists loop_agent_assignments_run_idx on public.loop_agent_assignments (run_id, created_at asc);
create index if not exists loop_agent_assignments_status_idx on public.loop_agent_assignments (status, created_at asc);
create index if not exists loop_agent_assignments_lease_idx on public.loop_agent_assignments (lease_owner, lease_expires_at);

create table if not exists public.loop_agent_events (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  assignment_id text,
  agent_id text,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists loop_agent_events_run_idx on public.loop_agent_events (run_id, created_at asc);
create index if not exists loop_agent_events_assignment_idx on public.loop_agent_events (assignment_id, created_at asc);

create table if not exists public.loop_run_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_id text not null unique,
  run_id text not null,
  assignment_id text,
  type text not null check (type in ('plan','diff','screenshot','report','log','test_output','deployment','markdown','json')),
  name text not null,
  uri text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists loop_run_artifacts_run_idx on public.loop_run_artifacts (run_id, created_at desc);

create table if not exists public.loop_run_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluation_id text not null unique,
  run_id text not null,
  assignment_id text,
  evaluator_agent_id text,
  status text not null default 'pending' check (status in ('pending','running','pass','warn','fail')),
  score int check (score between 0 and 100),
  summary text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loop_run_evaluations_run_idx on public.loop_run_evaluations (run_id, created_at desc);

create table if not exists public.loop_run_approvals (
  id uuid primary key default gen_random_uuid(),
  approval_id text not null unique,
  run_id text not null,
  assignment_id text,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  action_type text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  requested_by text not null default 'orchestrator',
  approved_by text,
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists loop_run_approvals_status_idx on public.loop_run_approvals (status, created_at desc);

create table if not exists public.loop_resource_locks (
  id uuid primary key default gen_random_uuid(),
  lock_id text not null unique,
  project_id text not null,
  resource_type text not null,
  resource_key text not null,
  owner_assignment_id text not null,
  mode text not null default 'write' check (mode in ('read','write','exclusive')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (project_id, resource_type, resource_key, mode)
);
create index if not exists loop_resource_locks_expiry_idx on public.loop_resource_locks (expires_at);

create table if not exists public.loop_cost_events (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  assignment_id text,
  model_profile_id text,
  provider text,
  model text,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists loop_cost_events_run_idx on public.loop_cost_events (run_id, created_at desc);

create table if not exists public.loop_worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null unique,
  agent_id text,
  status text not null default 'online' check (status in ('online','offline','degraded')),
  current_assignment_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_heartbeat timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.set_loop_orchestrator_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_loop_projects_updated_at on public.loop_projects;
create trigger set_loop_projects_updated_at before update on public.loop_projects for each row execute function public.set_loop_orchestrator_updated_at();

drop trigger if exists set_loop_model_profiles_updated_at on public.loop_model_profiles;
create trigger set_loop_model_profiles_updated_at before update on public.loop_model_profiles for each row execute function public.set_loop_orchestrator_updated_at();

drop trigger if exists set_loop_agent_registry_updated_at on public.loop_agent_registry;
create trigger set_loop_agent_registry_updated_at before update on public.loop_agent_registry for each row execute function public.set_loop_orchestrator_updated_at();

drop trigger if exists set_loop_orchestrator_runs_updated_at on public.loop_orchestrator_runs;
create trigger set_loop_orchestrator_runs_updated_at before update on public.loop_orchestrator_runs for each row execute function public.set_loop_orchestrator_updated_at();

drop trigger if exists set_loop_agent_assignments_updated_at on public.loop_agent_assignments;
create trigger set_loop_agent_assignments_updated_at before update on public.loop_agent_assignments for each row execute function public.set_loop_orchestrator_updated_at();

drop trigger if exists set_loop_run_evaluations_updated_at on public.loop_run_evaluations;
create trigger set_loop_run_evaluations_updated_at before update on public.loop_run_evaluations for each row execute function public.set_loop_orchestrator_updated_at();

alter table public.loop_projects enable row level security;
alter table public.loop_model_profiles enable row level security;
alter table public.loop_agent_registry enable row level security;
alter table public.loop_orchestrator_runs enable row level security;
alter table public.loop_agent_assignments enable row level security;
alter table public.loop_agent_events enable row level security;
alter table public.loop_run_artifacts enable row level security;
alter table public.loop_run_evaluations enable row level security;
alter table public.loop_run_approvals enable row level security;
alter table public.loop_resource_locks enable row level security;
alter table public.loop_cost_events enable row level security;
alter table public.loop_worker_heartbeats enable row level security;

drop policy if exists "loop_projects_public_read" on public.loop_projects;
create policy "loop_projects_public_read" on public.loop_projects for select using (true);
drop policy if exists "loop_model_profiles_public_read" on public.loop_model_profiles;
create policy "loop_model_profiles_public_read" on public.loop_model_profiles for select using (true);
drop policy if exists "loop_agent_registry_public_read" on public.loop_agent_registry;
create policy "loop_agent_registry_public_read" on public.loop_agent_registry for select using (true);
drop policy if exists "loop_orchestrator_runs_public_read" on public.loop_orchestrator_runs;
create policy "loop_orchestrator_runs_public_read" on public.loop_orchestrator_runs for select using (true);
drop policy if exists "loop_agent_assignments_public_read" on public.loop_agent_assignments;
create policy "loop_agent_assignments_public_read" on public.loop_agent_assignments for select using (true);
drop policy if exists "loop_agent_events_public_read" on public.loop_agent_events;
create policy "loop_agent_events_public_read" on public.loop_agent_events for select using (true);
drop policy if exists "loop_run_artifacts_public_read" on public.loop_run_artifacts;
create policy "loop_run_artifacts_public_read" on public.loop_run_artifacts for select using (true);
drop policy if exists "loop_run_evaluations_public_read" on public.loop_run_evaluations;
create policy "loop_run_evaluations_public_read" on public.loop_run_evaluations for select using (true);
drop policy if exists "loop_run_approvals_public_read" on public.loop_run_approvals;
create policy "loop_run_approvals_public_read" on public.loop_run_approvals for select using (true);
drop policy if exists "loop_resource_locks_public_read" on public.loop_resource_locks;
create policy "loop_resource_locks_public_read" on public.loop_resource_locks for select using (true);
drop policy if exists "loop_cost_events_public_read" on public.loop_cost_events;
create policy "loop_cost_events_public_read" on public.loop_cost_events for select using (true);
drop policy if exists "loop_worker_heartbeats_public_read" on public.loop_worker_heartbeats;
create policy "loop_worker_heartbeats_public_read" on public.loop_worker_heartbeats for select using (true);

insert into public.loop_model_profiles (model_profile_id, label, provider, model, purpose, cost_tier, latency_tier, capabilities, fallback_profile_ids) values
  ('reasoning_max','Reasoning Max','configured','highest-effort','orchestration/planning','high','slow','{"tool_calling":true,"long_context":true}'::jsonb,'["code_builder","fast_summary"]'::jsonb),
  ('code_builder','Code Builder','configured','code-capable','implementation','high','normal','{"code":true,"tool_calling":true}'::jsonb,'["reasoning_max"]'::jsonb),
  ('verifier_strict','Strict Verifier','configured','independent-verifier','qa/verifier','medium','normal','{"critique":true,"json_mode":true}'::jsonb,'["reasoning_max"]'::jsonb),
  ('vision_qa','Vision QA','configured','vision-capable','visual qa','medium','normal','{"vision":true}'::jsonb,'["verifier_strict"]'::jsonb),
  ('fast_summary','Fast Summary','configured','fast-low-cost','summaries','low','fast','{"summarization":true}'::jsonb,'[]'::jsonb),
  ('seo_research','SEO Research','configured','web-research','seo/research','medium','normal','{"web":true,"research":true}'::jsonb,'["fast_summary"]'::jsonb)
on conflict (model_profile_id) do update set
  label = excluded.label,
  provider = excluded.provider,
  model = excluded.model,
  purpose = excluded.purpose,
  cost_tier = excluded.cost_tier,
  latency_tier = excluded.latency_tier,
  capabilities = excluded.capabilities,
  fallback_profile_ids = excluded.fallback_profile_ids;

insert into public.loop_agent_registry (agent_id, name, type, role, capabilities, allowed_tools, default_model_profile_id, status) values
  ('orchestrator','Orchestrator','hermes','decompose and coordinate runs','["planning","routing","synthesis"]'::jsonb,'["supabase","telegram","dashboard"]'::jsonb,'reasoning_max','online'),
  ('planner','Planner','hermes','create implementation plans','["planning","requirements"]'::jsonb,'["read","web"]'::jsonb,'reasoning_max','online'),
  ('frontend_builder','Frontend Builder','hermes','build dashboard UI','["react","css","browser_qa"]'::jsonb,'["files","tests","browser"]'::jsonb,'code_builder','online'),
  ('backend_builder','Backend Builder','hermes','build API/schema/workers','["api","supabase","typescript"]'::jsonb,'["files","terminal","supabase"]'::jsonb,'code_builder','online'),
  ('qa_verifier','QA Verifier','qa_bot','run tests and production QA','["tests","browser","screenshots"]'::jsonb,'["tests","browser","terminal"]'::jsonb,'verifier_strict','online'),
  ('security_guard','Security Guard','security_bot','review secrets and risky actions','["secret_scan","policy","approval"]'::jsonb,'["rafter","read"]'::jsonb,'verifier_strict','online'),
  ('seo_researcher','SEO Researcher','seo_bot','SEO/local SEO research','["seo","research","content"]'::jsonb,'["web","seo_tools"]'::jsonb,'seo_research','online')
on conflict (agent_id) do update set
  name = excluded.name,
  type = excluded.type,
  role = excluded.role,
  capabilities = excluded.capabilities,
  allowed_tools = excluded.allowed_tools,
  default_model_profile_id = excluded.default_model_profile_id,
  status = excluded.status;
