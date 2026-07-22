-- P0 auth containment: remove legacy anonymous operational reads.
-- Forward-only. Apply manually before deploying code that writes activation metadata.

alter table public.loop_activations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Central read scope for the first contained production operator. This is
-- intentionally fail-closed: a valid Supabase account with any other email has
-- no operational-table access. Future operators must be added through a
-- reviewed migration (or a dedicated membership table in a later phase).
create or replace function public.loop_dashboard_authorized()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'service@maximo-seo.com';
$$;

revoke all on function public.loop_dashboard_authorized() from public;
grant execute on function public.loop_dashboard_authorized() to authenticated;

-- Apply proposal state and its audit row atomically. The API invokes this with
-- the service role after authenticating and allowlisting the approver.
create or replace function public.apply_loop_proposal_decision(
  p_proposal_id text,
  p_decision text,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  decision_at timestamptz := clock_timestamp();
  next_status text;
  audit_action text;
begin
  if p_decision = 'approved' then
    next_status := 'active';
    audit_action := 'approved';
  elsif p_decision = 'rejected' then
    next_status := 'rejected';
    audit_action := 'rejected';
  else
    raise exception 'Invalid proposal decision';
  end if;

  -- The pending_approval predicate is the compare-and-set boundary. Under
  -- concurrent decisions PostgreSQL rechecks it after the row lock is acquired,
  -- so exactly one caller can update and emit an audit row.
  update public.loop_proposals
  set status = next_status,
      eval_summary = jsonb_build_object(
        'approved_by', coalesce(p_actor_email, p_actor_user_id::text),
        'actor_user_id', p_actor_user_id,
        'actor_email', p_actor_email,
        'reason', left(coalesce(p_reason, ''), 500),
        'timestamp', decision_at
      ),
      activated_at = case when next_status = 'active' then decision_at else activated_at end,
      rolled_back_at = case when next_status = 'rejected' then decision_at else rolled_back_at end
  where proposal_id = p_proposal_id
    and status = 'pending_approval';

  if not found then
    if exists (select 1 from public.loop_proposals where proposal_id = p_proposal_id) then
      return 'not_pending';
    end if;
    return 'not_found';
  end if;

  insert into public.loop_activations (proposal_id, action, reason, metadata, created_at)
  values (
    p_proposal_id,
    audit_action,
    left(coalesce(p_reason, ''), 500),
    jsonb_build_object('actor_user_id', p_actor_user_id, 'actor_email', p_actor_email),
    decision_at
  );

  return 'applied';
end;
$$;

revoke all on function public.apply_loop_proposal_decision(text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_loop_proposal_decision(text, text, text, uuid, text) to service_role;

-- Remove every legacy public-read policy created by the core, task, and
-- orchestrator schema migrations.
drop policy if exists "loop_state_public_read" on public.loop_state;
drop policy if exists "loop_iterations_public_read" on public.loop_iterations;
drop policy if exists "loop_scores_public_read" on public.loop_scores;
drop policy if exists "loop_lessons_public_read" on public.loop_lessons;
drop policy if exists "loop_proposals_public_read" on public.loop_proposals;
drop policy if exists "loop_eval_results_public_read" on public.loop_eval_results;
drop policy if exists "loop_failure_patterns_public_read" on public.loop_failure_patterns;
drop policy if exists "loop_activations_public_read" on public.loop_activations;
drop policy if exists "loop_task_handoffs_public_read" on public.loop_task_handoffs;
drop policy if exists "loop_task_events_public_read" on public.loop_task_events;
drop policy if exists "loop_projects_public_read" on public.loop_projects;
drop policy if exists "loop_model_profiles_public_read" on public.loop_model_profiles;
drop policy if exists "loop_agent_registry_public_read" on public.loop_agent_registry;
drop policy if exists "loop_orchestrator_runs_public_read" on public.loop_orchestrator_runs;
drop policy if exists "loop_agent_assignments_public_read" on public.loop_agent_assignments;
drop policy if exists "loop_agent_events_public_read" on public.loop_agent_events;
drop policy if exists "loop_run_artifacts_public_read" on public.loop_run_artifacts;
drop policy if exists "loop_run_evaluations_public_read" on public.loop_run_evaluations;
drop policy if exists "loop_run_approvals_public_read" on public.loop_run_approvals;
drop policy if exists "loop_resource_locks_public_read" on public.loop_resource_locks;
drop policy if exists "loop_cost_events_public_read" on public.loop_cost_events;
drop policy if exists "loop_worker_heartbeats_public_read" on public.loop_worker_heartbeats;

-- The earlier phase-2 policy allowed any signed-in user to update proposals
-- directly, bypassing the server-side approver allowlist. All browser writes are
-- revoked below; proposal mutations remain service-role API operations.
drop policy if exists "loop_proposals_auth_update" on public.loop_proposals;

-- Reset grants explicitly. RLS policies do not protect a table if an accidental
-- grant/policy combination is reintroduced, so anon receives no table privilege.
revoke all privileges on table
  public.loop_state,
  public.loop_iterations,
  public.loop_scores,
  public.loop_lessons,
  public.loop_proposals,
  public.loop_eval_results,
  public.loop_failure_patterns,
  public.loop_activations,
  public.loop_task_handoffs,
  public.loop_task_events,
  public.loop_projects,
  public.loop_model_profiles,
  public.loop_agent_registry,
  public.loop_orchestrator_runs,
  public.loop_agent_assignments,
  public.loop_agent_events,
  public.loop_run_artifacts,
  public.loop_run_evaluations,
  public.loop_run_approvals,
  public.loop_resource_locks,
  public.loop_cost_events,
  public.loop_worker_heartbeats
from anon;

-- Authenticated users are read-only. Start from no privileges so no legacy
-- UPDATE/INSERT/DELETE grant can bypass the role-gated APIs.
revoke all privileges on table
  public.loop_state,
  public.loop_iterations,
  public.loop_scores,
  public.loop_lessons,
  public.loop_proposals,
  public.loop_eval_results,
  public.loop_failure_patterns,
  public.loop_activations,
  public.loop_task_handoffs,
  public.loop_task_events,
  public.loop_projects,
  public.loop_model_profiles,
  public.loop_agent_registry,
  public.loop_orchestrator_runs,
  public.loop_agent_assignments,
  public.loop_agent_events,
  public.loop_run_artifacts,
  public.loop_run_evaluations,
  public.loop_run_approvals,
  public.loop_resource_locks,
  public.loop_cost_events,
  public.loop_worker_heartbeats
from authenticated;

-- Replace/restate scoped authenticated read policies idempotently.
drop policy if exists "loop_state_auth_read" on public.loop_state;
drop policy if exists "loop_iterations_auth_read" on public.loop_iterations;
drop policy if exists "loop_scores_auth_read" on public.loop_scores;
drop policy if exists "loop_lessons_auth_read" on public.loop_lessons;
drop policy if exists "loop_proposals_auth_read" on public.loop_proposals;
drop policy if exists "loop_eval_results_auth_read" on public.loop_eval_results;
drop policy if exists "loop_failure_patterns_auth_read" on public.loop_failure_patterns;
drop policy if exists "loop_activations_auth_read" on public.loop_activations;
drop policy if exists "loop_task_handoffs_auth_read" on public.loop_task_handoffs;
drop policy if exists "loop_task_events_auth_read" on public.loop_task_events;
drop policy if exists "loop_projects_auth_read" on public.loop_projects;
drop policy if exists "loop_model_profiles_auth_read" on public.loop_model_profiles;
drop policy if exists "loop_agent_registry_auth_read" on public.loop_agent_registry;
drop policy if exists "loop_orchestrator_runs_auth_read" on public.loop_orchestrator_runs;
drop policy if exists "loop_agent_assignments_auth_read" on public.loop_agent_assignments;
drop policy if exists "loop_agent_events_auth_read" on public.loop_agent_events;
drop policy if exists "loop_run_artifacts_auth_read" on public.loop_run_artifacts;
drop policy if exists "loop_run_approvals_auth_read" on public.loop_run_approvals;
drop policy if exists "loop_cost_events_auth_read" on public.loop_cost_events;
drop policy if exists "loop_worker_heartbeats_auth_read" on public.loop_worker_heartbeats;

create policy "loop_state_auth_read" on public.loop_state for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_iterations_auth_read" on public.loop_iterations for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_scores_auth_read" on public.loop_scores for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_lessons_auth_read" on public.loop_lessons for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_proposals_auth_read" on public.loop_proposals for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_eval_results_auth_read" on public.loop_eval_results for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_failure_patterns_auth_read" on public.loop_failure_patterns for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_activations_auth_read" on public.loop_activations for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_task_handoffs_auth_read" on public.loop_task_handoffs for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_task_events_auth_read" on public.loop_task_events for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_projects_auth_read" on public.loop_projects for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_model_profiles_auth_read" on public.loop_model_profiles for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_agent_registry_auth_read" on public.loop_agent_registry for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_orchestrator_runs_auth_read" on public.loop_orchestrator_runs for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_agent_assignments_auth_read" on public.loop_agent_assignments for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_agent_events_auth_read" on public.loop_agent_events for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_run_artifacts_auth_read" on public.loop_run_artifacts for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_run_approvals_auth_read" on public.loop_run_approvals for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_cost_events_auth_read" on public.loop_cost_events for select to authenticated using (public.loop_dashboard_authorized());
create policy "loop_worker_heartbeats_auth_read" on public.loop_worker_heartbeats for select to authenticated using (public.loop_dashboard_authorized());

-- run_evaluations and resource_locks are worker/service-role operational data and
-- intentionally receive no browser read policy or grant.
grant select on table
  public.loop_state,
  public.loop_iterations,
  public.loop_scores,
  public.loop_lessons,
  public.loop_proposals,
  public.loop_eval_results,
  public.loop_failure_patterns,
  public.loop_activations,
  public.loop_task_handoffs,
  public.loop_task_events,
  public.loop_projects,
  public.loop_model_profiles,
  public.loop_agent_registry,
  public.loop_orchestrator_runs,
  public.loop_agent_assignments,
  public.loop_agent_events,
  public.loop_run_artifacts,
  public.loop_run_approvals,
  public.loop_cost_events,
  public.loop_worker_heartbeats
to authenticated;
