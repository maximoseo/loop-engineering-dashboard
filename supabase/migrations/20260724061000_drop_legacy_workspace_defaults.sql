-- Phase 2 of the workspace-tenancy rollout.
-- Apply only after the workspace-aware API/worker deployment is healthy.
-- Fresh environments apply this immediately after the tenancy migration.

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
    execute format('alter table public.%I alter column workspace_id drop default', table_name);
  end loop;
end $$;
