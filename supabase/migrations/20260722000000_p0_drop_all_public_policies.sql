-- P0 Security Remediation: Drop ALL remaining public_read policies and create authenticated-only replacements.
-- This migration completes the work started in 20260718000000_phase2_rls_auth.sql

-- ============================================================
-- 1. TASK QUEUE TABLES: drop public policies from task queue migration
-- ============================================================
drop policy if exists "loop_task_handoffs_public_read" on public.loop_task_handoffs;
drop policy if exists "loop_task_events_public_read" on public.loop_task_events;

create policy "loop_task_handoffs_auth_read" on public.loop_task_handoffs
  for select using (auth.role() = 'authenticated');

create policy "loop_task_events_auth_read" on public.loop_task_events
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- 2. ORCHESTRATOR TABLES: drop public policies from orchestrator migration
-- ============================================================
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

-- Create authenticated-only read policies for orchestrator tables
create policy "loop_projects_auth_read" on public.loop_projects
  for select using (auth.role() = 'authenticated');

create policy "loop_model_profiles_auth_read" on public.loop_model_profiles
  for select using (auth.role() = 'authenticated');

create policy "loop_agent_registry_auth_read" on public.loop_agent_registry
  for select using (auth.role() = 'authenticated');

create policy "loop_orchestrator_runs_auth_read" on public.loop_orchestrator_runs
  for select using (auth.role() = 'authenticated');

create policy "loop_agent_assignments_auth_read" on public.loop_agent_assignments
  for select using (auth.role() = 'authenticated');

create policy "loop_agent_events_auth_read" on public.loop_agent_events
  for select using (auth.role() = 'authenticated');

create policy "loop_run_artifacts_auth_read" on public.loop_run_artifacts
  for select using (auth.role() = 'authenticated');

create policy "loop_run_evaluations_auth_read" on public.loop_run_evaluations
  for select using (auth.role() = 'authenticated');

create policy "loop_run_approvals_auth_read" on public.loop_run_approvals
  for select using (auth.role() = 'authenticated');

create policy "loop_resource_locks_auth_read" on public.loop_resource_locks
  for select using (auth.role() = 'authenticated');

create policy "loop_cost_events_auth_read" on public.loop_cost_events
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- 3. REALTIME PUBLICATION: update comment to reflect authenticated access
-- ============================================================
-- The supabase_realtime publication tables now require authenticated RLS.
-- Only authenticated users with valid sessions will receive postgres_changes events.
