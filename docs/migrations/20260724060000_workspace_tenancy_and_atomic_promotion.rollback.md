# Rollback: workspace tenancy and atomic promotion

This migration is intentionally **not automatically reversible** after more than one workspace contains data. Dropping `workspace_id` would merge tenant data and can create key collisions.

Before rollback:

1. Stop all API/worker writes.
2. Export every affected table grouped by `workspace_id` and retain the membership tables for audit.
3. Confirm only the legacy workspace (`00000000-0000-4000-8000-000000000001`) exists, or restore a pre-migration backup instead.

For a legacy-only rollback, in one transaction: drop `transition_loop_proposal` and the new six-argument `apply_loop_proposal_decision`, restore the prior five-argument function from `20260722010000_p0_auth_containment.sql`, restore that migration's read policies, restore `loop_state` primary key to `(id)`, then drop each `*_workspace_fk`, `*_workspace_idx`, and `workspace_id` column before dropping `loop_workspace_members`, `loop_workspaces`, and `loop_workspace_authorized`.

Recommended production rollback: point-in-time restore to immediately before this migration, then redeploy the preceding application version. Never perform a schema-only rollback while multi-workspace rows exist.
