-- Phase 4 (DB perf): cover unindexed foreign keys on the multi-agent orchestrator
-- tables and pin a fixed search_path on the loop trigger functions.
-- Addresses Supabase performance/security advisors: unindexed_foreign_keys,
-- function_search_path_mutable. Safe/idempotent.

create index if not exists idx_loop_agent_assignments_agent_id
  on public.loop_agent_assignments (agent_id);
create index if not exists idx_loop_agent_assignments_model_profile_id
  on public.loop_agent_assignments (model_profile_id);
create index if not exists idx_loop_agent_assignments_project_id
  on public.loop_agent_assignments (project_id);
create index if not exists idx_loop_agent_registry_default_model_profile_id
  on public.loop_agent_registry (default_model_profile_id);

alter function public.set_loop_task_updated_at() set search_path = '';
alter function public.set_loop_orchestrator_updated_at() set search_path = '';
