-- Phase 2 RLS hardening: restrict reads to authenticated users.
-- After Supabase Auth is deployed, run this migration.

-- Replace public-read policies with authenticated-only
drop policy if exists "loop_state_public_read" on public.loop_state;
drop policy if exists "loop_iterations_public_read" on public.loop_iterations;
drop policy if exists "loop_scores_public_read" on public.loop_scores;
drop policy if exists "loop_lessons_public_read" on public.loop_lessons;
drop policy if exists "loop_proposals_public_read" on public.loop_proposals;
drop policy if exists "loop_eval_results_public_read" on public.loop_eval_results;
drop policy if exists "loop_failure_patterns_public_read" on public.loop_failure_patterns;
drop policy if exists "loop_activations_public_read" on public.loop_activations;

create policy "loop_state_auth_read" on public.loop_state for select using (auth.role() = 'authenticated');
create policy "loop_iterations_auth_read" on public.loop_iterations for select using (auth.role() = 'authenticated');
create policy "loop_scores_auth_read" on public.loop_scores for select using (auth.role() = 'authenticated');
create policy "loop_lessons_auth_read" on public.loop_lessons for select using (auth.role() = 'authenticated');
create policy "loop_proposals_auth_read" on public.loop_proposals for select using (auth.role() = 'authenticated');
create policy "loop_eval_results_auth_read" on public.loop_eval_results for select using (auth.role() = 'authenticated');
create policy "loop_failure_patterns_auth_read" on public.loop_failure_patterns for select using (auth.role() = 'authenticated');
create policy "loop_activations_auth_read" on public.loop_activations for select using (auth.role() = 'authenticated');

-- Write policies for authenticated users on proposals (approve/reject)
create policy "loop_proposals_auth_update" on public.loop_proposals
  for update using (auth.role() = 'authenticated')
  with check (new.status in ('proposed','testing','pending_approval','active','rejected','rolled_back'));

-- Keep loop_task_handoffs and loop_task_events service-role only (no anon access)
-- These tables are in the separate task queue migration
