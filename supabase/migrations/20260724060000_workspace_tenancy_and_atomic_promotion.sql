-- Workspace tenancy, ownership boundaries, and atomic proposal promotion.
-- IMPORTANT: review LOOP_BOOTSTRAP_OPERATOR_EMAIL before applying in another environment.
-- Rollback notes: docs/migrations/20260724060000_workspace_tenancy_and_atomic_promotion.rollback.md

create table public.loop_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  created_at timestamptz not null default now()
);

create table public.loop_workspace_members (
  workspace_id uuid not null references public.loop_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','operator','viewer')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index loop_workspace_members_user_idx on public.loop_workspace_members(user_id, status);

insert into public.loop_workspaces (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'Legacy workspace', 'legacy')
on conflict (id) do nothing;

-- Preserve access for the previously hard-coded contained operator.
insert into public.loop_workspace_members (workspace_id, user_id, role)
select '00000000-0000-4000-8000-000000000001', id, 'owner'
from auth.users where lower(email) = 'service@maximo-seo.com'
on conflict do nothing;

-- Add and backfill tenant ownership. New service-role writes must always provide it.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'loop_state','loop_iterations','loop_scores','loop_lessons','loop_proposals',
    'loop_eval_results','loop_failure_patterns','loop_activations','loop_task_handoffs',
    'loop_task_events','loop_projects','loop_model_profiles','loop_agent_registry',
    'loop_orchestrator_runs','loop_agent_assignments','loop_agent_events',
    'loop_run_artifacts','loop_run_evaluations','loop_run_approvals','loop_resource_locks',
    'loop_cost_events','loop_worker_heartbeats'
  ] loop
    -- Temporary default keeps the pre-deploy API compatible during the two-phase rollout.
    -- 20260724061000 drops it after the workspace-aware application is live.
    execute format('alter table public.%I add column workspace_id uuid default %L::uuid', table_name, '00000000-0000-4000-8000-000000000001');
    execute format('update public.%I set workspace_id = %L where workspace_id is null', table_name, '00000000-0000-4000-8000-000000000001');
    execute format('alter table public.%I alter column workspace_id set not null', table_name);
    execute format('alter table public.%I add constraint %I foreign key (workspace_id) references public.loop_workspaces(id) on delete restrict', table_name, table_name || '_workspace_fk');
    execute format('create index %I on public.%I(workspace_id)', table_name || '_workspace_idx', table_name);
  end loop;
end $$;

-- Tenant-safe state and natural-key uniqueness. Existing global unique constraints
-- remain intentionally stricter for this migration; identifiers are random and no
-- cross-workspace lookup is permitted by APIs or RLS.
alter table public.loop_state drop constraint loop_state_pkey;
alter table public.loop_state add primary key (workspace_id, id);

-- Natural identifiers are tenant-local. Replace global uniqueness and foreign
-- keys with composite ownership constraints so child rows cannot cross tenants.
alter table public.loop_scores drop constraint loop_scores_task_id_fkey;
alter table public.loop_task_events drop constraint loop_task_events_task_id_fkey;
alter table public.loop_orchestrator_runs drop constraint loop_orchestrator_runs_project_id_fkey;
alter table public.loop_agent_assignments drop constraint loop_agent_assignments_project_id_fkey;
alter table public.loop_agent_assignments drop constraint loop_agent_assignments_run_id_fkey;
alter table public.loop_agent_assignments drop constraint loop_agent_assignments_agent_id_fkey;
alter table public.loop_agent_assignments drop constraint loop_agent_assignments_model_profile_id_fkey;
alter table public.loop_agent_registry drop constraint loop_agent_registry_default_model_profile_id_fkey;

alter table public.loop_iterations drop constraint loop_iterations_task_id_key;
alter table public.loop_lessons drop constraint loop_lessons_lesson_id_key;
alter table public.loop_proposals drop constraint loop_proposals_proposal_id_key;
alter table public.loop_failure_patterns drop constraint loop_failure_patterns_pattern_key_key;
alter table public.loop_task_handoffs drop constraint loop_task_handoffs_task_id_key;
alter table public.loop_projects drop constraint loop_projects_project_id_key;
alter table public.loop_model_profiles drop constraint loop_model_profiles_model_profile_id_key;
alter table public.loop_agent_registry drop constraint loop_agent_registry_agent_id_key;
alter table public.loop_orchestrator_runs drop constraint loop_orchestrator_runs_run_id_key;
alter table public.loop_agent_assignments drop constraint loop_agent_assignments_assignment_id_key;
alter table public.loop_run_artifacts drop constraint loop_run_artifacts_artifact_id_key;
alter table public.loop_run_evaluations drop constraint loop_run_evaluations_evaluation_id_key;
alter table public.loop_run_approvals drop constraint loop_run_approvals_approval_id_key;
alter table public.loop_resource_locks drop constraint loop_resource_locks_lock_id_key;
alter table public.loop_worker_heartbeats drop constraint loop_worker_heartbeats_worker_id_key;

alter table public.loop_iterations add unique(workspace_id, task_id);
alter table public.loop_lessons add unique(workspace_id, lesson_id);
alter table public.loop_proposals add unique(workspace_id, proposal_id);
alter table public.loop_failure_patterns add unique(workspace_id, pattern_key);
alter table public.loop_task_handoffs add unique(workspace_id, task_id);
alter table public.loop_projects add unique(workspace_id, project_id);
alter table public.loop_model_profiles add unique(workspace_id, model_profile_id);
alter table public.loop_agent_registry add unique(workspace_id, agent_id);
alter table public.loop_orchestrator_runs add unique(workspace_id, run_id);
alter table public.loop_agent_assignments add unique(workspace_id, assignment_id);
alter table public.loop_run_artifacts add unique(workspace_id, artifact_id);
alter table public.loop_run_evaluations add unique(workspace_id, evaluation_id);
alter table public.loop_run_approvals add unique(workspace_id, approval_id);
alter table public.loop_resource_locks add unique(workspace_id, lock_id);
alter table public.loop_worker_heartbeats add unique(workspace_id, worker_id);

alter table public.loop_scores add foreign key(workspace_id, task_id)
  references public.loop_iterations(workspace_id, task_id) on delete cascade;
alter table public.loop_task_events add foreign key(workspace_id, task_id)
  references public.loop_task_handoffs(workspace_id, task_id) on delete cascade;
alter table public.loop_orchestrator_runs add foreign key(workspace_id, project_id)
  references public.loop_projects(workspace_id, project_id) on delete cascade;
alter table public.loop_agent_assignments add foreign key(workspace_id, project_id)
  references public.loop_projects(workspace_id, project_id) on delete cascade;
alter table public.loop_agent_assignments add foreign key(workspace_id, run_id)
  references public.loop_orchestrator_runs(workspace_id, run_id) on delete cascade;
alter table public.loop_agent_assignments add foreign key(workspace_id, agent_id)
  references public.loop_agent_registry(workspace_id, agent_id);
alter table public.loop_agent_assignments add foreign key(workspace_id, model_profile_id)
  references public.loop_model_profiles(workspace_id, model_profile_id);
alter table public.loop_agent_registry add foreign key(workspace_id, default_model_profile_id)
  references public.loop_model_profiles(workspace_id, model_profile_id);

create or replace function public.loop_workspace_authorized(p_workspace_id uuid, p_mutate boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.loop_workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
      and m.status = 'active'
      and (not p_mutate or m.role in ('owner','admin','operator'))
  );
$$;
revoke all on function public.loop_workspace_authorized(uuid, boolean) from public, anon;
grant execute on function public.loop_workspace_authorized(uuid, boolean) to authenticated;

alter table public.loop_workspaces enable row level security;
alter table public.loop_workspace_members enable row level security;
create policy loop_workspaces_member_read on public.loop_workspaces for select to authenticated
  using (public.loop_workspace_authorized(id));
create policy loop_workspace_members_self_read on public.loop_workspace_members for select to authenticated
  using (user_id = auth.uid() and status = 'active');
grant select on public.loop_workspaces, public.loop_workspace_members to authenticated;
revoke all on public.loop_workspaces, public.loop_workspace_members from anon;

-- Replace all browser read policies with membership-scoped policies.
do $$
declare table_name text; policy_name text;
begin
  foreach table_name in array array[
    'loop_state','loop_iterations','loop_scores','loop_lessons','loop_proposals',
    'loop_eval_results','loop_failure_patterns','loop_activations','loop_task_handoffs',
    'loop_task_events','loop_projects','loop_model_profiles','loop_agent_registry',
    'loop_orchestrator_runs','loop_agent_assignments','loop_agent_events',
    'loop_run_artifacts','loop_run_approvals','loop_cost_events','loop_worker_heartbeats'
  ] loop
    policy_name := table_name || '_auth_read';
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.loop_workspace_authorized(workspace_id))', policy_name, table_name);
  end loop;
end $$;

-- Replace the legacy unscoped promotion RPC. The transaction locks and validates
-- the proposal, verifies tenant ownership and eval evidence, updates state, and
-- writes the audit row as one atomic operation.
drop function if exists public.apply_loop_proposal_decision(text, text, text, uuid, text);
create function public.apply_loop_proposal_decision(
  p_workspace_id uuid,
  p_proposal_id text,
  p_decision text,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_email text
) returns text language plpgsql security definer set search_path = '' as $$
declare proposal public.loop_proposals%rowtype; decision_at timestamptz := clock_timestamp(); next_status text;
begin
  select * into proposal from public.loop_proposals
  where workspace_id = p_workspace_id and proposal_id = p_proposal_id
  for update;
  if not found then return 'not_found'; end if;
  if proposal.status <> 'pending_approval' then return 'not_pending'; end if;
  if not exists (
    select 1 from public.loop_workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = p_actor_user_id
      and m.status = 'active' and m.role in ('owner','admin')
  ) then return 'forbidden'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid proposal decision'; end if;
  if p_decision = 'approved' and proposal.eval_required
     and coalesce((proposal.eval_summary ->> 'passed')::boolean, false) is not true then
    return 'evaluation_required';
  end if;
  next_status := case when p_decision = 'approved' then 'active' else 'rejected' end;
  update public.loop_proposals set
    status = next_status,
    eval_summary = proposal.eval_summary || jsonb_build_object(
      'approved_by', coalesce(p_actor_email, p_actor_user_id::text),
      'actor_user_id', p_actor_user_id, 'actor_email', p_actor_email,
      'reason', left(coalesce(p_reason, ''), 500), 'timestamp', decision_at),
    activated_at = case when next_status = 'active' then decision_at else activated_at end,
    rolled_back_at = case when next_status = 'rejected' then decision_at else rolled_back_at end
  where workspace_id = p_workspace_id and proposal_id = p_proposal_id;
  insert into public.loop_activations(workspace_id, proposal_id, action, reason, metadata, created_at)
  values (p_workspace_id, p_proposal_id, p_decision, left(coalesce(p_reason,''),500),
          jsonb_build_object('actor_user_id',p_actor_user_id,'actor_email',p_actor_email), decision_at);
  return 'applied';
end;
$$;
revoke all on function public.apply_loop_proposal_decision(uuid,text,text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.apply_loop_proposal_decision(uuid,text,text,text,uuid,text) to service_role;

-- Script-side file activation uses a compensating transaction: the file is
-- snapshotted/written first, then this RPC atomically compare-and-sets proposal
-- state and writes its audit row. The script restores the file if this RPC fails.
create function public.transition_loop_proposal(
  p_workspace_id uuid,
  p_proposal_id text,
  p_expected_status text,
  p_next_status text,
  p_action text,
  p_reason text,
  p_snapshot_path text,
  p_eval_summary jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare proposal public.loop_proposals%rowtype; transition_at timestamptz := clock_timestamp();
begin
  select * into proposal from public.loop_proposals
  where workspace_id = p_workspace_id and proposal_id = p_proposal_id
  for update;
  if not found then return 'not_found'; end if;
  if proposal.status <> p_expected_status then return 'conflict'; end if;
  if not (
    (p_expected_status = 'proposed' and p_next_status in ('testing','pending_approval','active')) or
    (p_expected_status = 'testing' and p_next_status in ('active','rejected','pending_approval')) or
    (p_expected_status = 'pending_approval' and p_next_status in ('active','rejected')) or
    (p_expected_status = 'active' and p_next_status = 'rolled_back')
  ) then return 'invalid_transition'; end if;
  if not (
    (p_next_status = 'active' and p_action in ('activated','approved')) or
    (p_next_status = 'rolled_back' and p_action = 'rolled_back') or
    (p_next_status = 'rejected' and p_action = 'rejected') or
    (p_next_status = 'pending_approval' and p_action = 'pending_approval')
  ) then return 'invalid_action'; end if;
  if p_next_status = 'active' and proposal.eval_required
     and coalesce((p_eval_summary ->> 'passed')::boolean, false) is not true then
    return 'evaluation_required';
  end if;

  update public.loop_proposals set
    status = p_next_status,
    eval_summary = coalesce(p_eval_summary, '{}'::jsonb),
    activated_at = case when p_next_status = 'active' then transition_at else activated_at end,
    rolled_back_at = case when p_next_status = 'rolled_back' then transition_at else rolled_back_at end
  where workspace_id = p_workspace_id and proposal_id = p_proposal_id;
  insert into public.loop_activations(workspace_id, proposal_id, action, reason, snapshot_path, created_at)
  values (p_workspace_id, p_proposal_id, p_action, left(coalesce(p_reason,''),300), p_snapshot_path, transition_at);
  return 'applied';
end;
$$;
revoke all on function public.transition_loop_proposal(uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.transition_loop_proposal(uuid,text,text,text,text,text,text,jsonb) to service_role;
