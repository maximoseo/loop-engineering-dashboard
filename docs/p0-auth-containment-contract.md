# P0 Auth Containment Contract

## Objective
Close unauthenticated operational reads and fail-open task/proposal authorization while restoring authenticated Supabase reads, without changing worker execution semantics or applying database migrations automatically.

## Acceptance
1. `GET /api/loop-task` requires a valid Supabase session before returning readiness, tasks, or events.
2. `POST /api/loop-task` denies when `LOOP_OPERATOR_EMAILS` is empty/unset and requires an allowlisted authenticated user.
3. `GET /api/orchestrator` requires an allowlisted authenticated operator or worker token; worker-only mutation paths stay worker-only.
4. Proposal approval denies when `LOOP_APPROVER_EMAILS` is empty/unset, records the authenticated actor, and commits the decision plus audit row atomically.
5. Browser data reads use the current Supabase session instead of the anon key as bearer token.
6. A forward-only SQL migration removes every legacy public-read policy and anon grant from operational tables, with authenticated read policies scoped to the approved production operator.
7. Unit/API-policy tests prove anonymous denial and fail-closed configuration.
8. Lint, unit tests, build, and existing E2E gate pass.

## Non-goals
- No organization/workspace multi-tenancy in this change set.
- No queue leasing/fencing rewrite.
- No UI redesign or analytics optimization.
- No automatic Supabase migration application; apply the reviewed migration deliberately.

## Constraints
- Keep the existing Vercel function shape.
- Preserve worker-token paths and current API response contracts where compatible with secure denial.
- Do not expose raw Supabase errors or secrets.
- Keep diffs reviewable and rollbackable.

## Deployment order
1. Configure non-empty production Supabase and operator/approver environment values.
2. Apply the forward-only containment migration while the already-session-aware dashboard remains deployed.
3. Merge/deploy the API and client changes.
4. Verify anonymous denial, allowlisted reads, worker routes, and proposal decision audit behavior.

## Production containment already applied
`LOOP_TASK_PUBLIC_ENABLED=false` was set in Vercel Production and the current production artifact was redeployed. Live verification returned `publicDeliveryEnabled:false` and `defaultRoute:"blocked_config"`.
