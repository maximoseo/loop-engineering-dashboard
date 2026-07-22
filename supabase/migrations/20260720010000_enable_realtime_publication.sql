-- Add the dashboard's live tables to the supabase_realtime publication so the SPA
-- can subscribe to postgres_changes for instant updates. Idempotent. Authenticated
-- SELECT RLS allows the authenticated (signed-in operator) role to receive these
-- change feeds.
do $$
declare t text;
begin
  foreach t in array array[
    'loop_state','loop_scores','loop_proposals','loop_orchestrator_runs',
    'loop_agent_assignments','loop_task_handoffs'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
