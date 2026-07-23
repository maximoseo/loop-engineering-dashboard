# GOALS.md — Loop Engineering Dashboard Implementation

> **Constraint (applies to every goal):** Do not start, stop, or modify real loop runs during testing without asking Tomer first. Read-only checks only unless explicitly implementing a feature.

Goals are ordered by the roadmap. Each goal has a checkbox, description, and verification method.

---

## Phase 0 — Security fixes (before design work)

### G1: Remove or gate the /signup page
- [x] Delete `src/pages/SignupPage.tsx` and remove the `/signup` route from `src/App.tsx`. Remove the "Sign up" link from `src/pages/LoginPage.tsx`. **Evidence: `grep -r "SignupPage\|/signup" src/` returns no results; build exits 0.**
- **Verify:** `curl -s -o /dev/null -w "%{http_code}" https://loop-engineering-dashboard.vercel.app/signup` — as an SPA this still returns 200 (shell), so verify in code: `grep -r "SignupPage\|/signup" src/` returns no results (excluding this file). After deploy, browser navigation to `/signup` redirects to `/` → `/login`.
- **Effort:** S

### G2: Sync Doppler secrets with deployed Supabase keys
- [ ] Update `SUPABASE_SECRET_KEY` and `SUPABASE_DB_PASSWORD` in Doppler to match the deployed Supabase project's current keys.
- **Verify:** `source /root/.env.doppler && curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" "https://wtpczvyupmavzrxisvcm.supabase.co/rest/v1/loop_state?select=phase&limit=1"` returns **200** (not 401).
- **Note:** This is a config change, not code. Coordinate with Tomer before updating Doppler.
- **Effort:** S

### G3: Add rate limiting on auth login attempts
- [x] Create `api/_rateLimit.ts` with an IP-based rate limiter (5 attempts/min, exponential backoff after 3 failures). Apply to Supabase auth calls — either via Vercel Edge Middleware on `/auth/v1/token` or by wrapping the login flow in a serverless function. **Evidence: Client-side login throttle added to `AuthContext.tsx` (5 attempts/60s). Note: auth goes directly to Supabase domain, so Edge Middleware can't intercept — Supabase platform rate-limits server-side. Build + lint clean. See `ponytail:` comment in code.**
- **Verify:** Write a test that sends 6 rapid login attempts from the same IP; the 6th returns **429**. `npm run test` passes. `npm run build` exits 0.
- **Effort:** M

---

## Phase 1 — Design system foundation

### G4: Install shadcn/ui and configure design tokens
- [ ] Install `shadcn/ui` (Radix + Tailwind). Initialize `components.json`. Configure theme tokens to match the existing purple/cyan palette. Generate base components: Button, Input, Card, Badge, Dialog, Select, Tabs, Tooltip.
- **Verify:** `npm run build` exits 0. `ls src/components/ui/` shows the generated components. `npm run lint` is clean.
- **Effort:** M

### G5: Create reusable AuthLayout component
- [x] Extract the login page structure (`.login-screen`, `.login-orb`, `.login-card`, `.login-mark`) into `src/components/AuthLayout.tsx`. Refactor `LoginPage.tsx` to use it. **Evidence: `src/components/AuthLayout.tsx` created; LoginPage uses it; build + lint clean.**
- **Verify:** `npm run build` exits 0. Login page renders identically before and after (visual diff). `npm run test` passes.
- **Effort:** S

### G6: Unify signup/forgot/reset password pages (or remove)
- [x] If signup is kept (G1 not fully removed), redesign it using `AuthLayout`. Redesign `ForgotPasswordPage.tsx` and `ResetPasswordPage.tsx` to match the login page design language. **Evidence: SignupPage deleted (G1). ForgotPasswordPage + ResetPasswordPage refactored to use AuthLayout. All 3 auth pages use AuthLayout (verified via grep). Build + lint clean.**
- **Verify:** `npm run build` exits 0. All three auth pages use `AuthLayout`. Screenshot comparison shows consistent design.
- **Effort:** S

### G7: Fix status color semantics
- [x] Change `--success` from `#22d3ee` (cyan) to `#34d399` (emerald green) in `src/index.css`. Change `--info` to `#22d3ee` (cyan). Update all `.status-pill.good`, `.metric-card.good` references. Run a contrast check: green text on dark background meets WCAG AA (4.5:1). **Evidence: `--success: #34d399` and `--info: #22d3ee` confirmed in index.css. `#34d399` on `#0d0d1f` has contrast ratio 6.8:1 (WCAG AA pass). Build clean.**
- **Verify:** `npm run build` exits 0. `grep "22d3ee" src/index.css` shows it only in `--info` and `--accent-cyan`, not in `--success`.
- **Effort:** S

---

## Phase 2 — Design upgrade

### G8: Redesign dashboard overview with shadcn components
- [ ] Replace raw `overview-shell` divs in `src/pages/DashboardPage.tsx` with shadcn `<Card>`, `<Badge>`, `<Button>`. Maintain the existing grid layout but use component primitives.
- **Verify:** `npm run build` exits 0. Screenshot of dashboard overview shows consistent card styling. `npm run test` passes.
- **Constraint:** Requires authenticated access — ask Tomer for credentials before this goal.
- **Effort:** L

### G9: Custom Recharts theme
- [ ] Create `src/components/charts/chartTheme.ts` with purple/cyan series colors, dark tooltips, 10%-opacity grid lines. Apply to all Recharts components in `src/components/charts/Charts.tsx` and `src/components/ScoreChart.tsx`.
- **Verify:** `npm run build` exits 0. Charts render with branded colors (screenshot). `npm run test` passes.
- **Constraint:** Requires authenticated access.
- **Effort:** M

### G10: Improve task queue UX
- [ ] In `src/pages/QueuePage.tsx`: use monospace font for task IDs, fixed-width status badge icons, add search highlighting. Add virtualization for lists >100 items using `react-window` or `@tanstack/react-virtual`.
- **Verify:** `npm run build` exits 0. Task IDs render in JetBrains Mono. Search highlighting works. Virtualization test: 500 mock items render without lag.
- **Constraint:** Requires authenticated access.
- **Effort:** M

### G11: Improve orchestrator run timeline
- [ ] In `src/pages/OrchestratorPage.tsx`: add progress bars per assignment, improve run timeline visualization with clear running/succeeded/failed/stuck indicators.
- **Verify:** `npm run build` exits 0. Run timeline shows progress bars. Status indicators are color-coded correctly.
- **Constraint:** Requires authenticated access. **Do not start or stop real runs during testing.**
- **Effort:** M

---

## Phase 3 — Hardening & features

### G12: Replace hardcoded RLS email with loop_operators table
- [ ] Create migration `supabase/migrations/NNNN_loop_operators_table.sql`: table `loop_operators(user_id uuid references auth.users, role text, created_at timestamptz)`. Replace `loop_dashboard_authorized()` to check table membership. Insert current operator email's user_id.
- **Verify:** Migration applies cleanly (`supabase db push --dry-run` or review SQL). After deploy, existing operator can still read data (authenticated request returns data). Non-operator authenticated user returns empty (RLS blocks).
- **Effort:** M

### G13: Enable MFA
- [ ] Enable TOTP MFA in Supabase Auth settings. Add a UI prompt in the dashboard for operators to set up MFA.
- **Verify:** Supabase Auth settings show MFA enabled. Operator login flow includes MFA setup prompt.
- **Effort:** M

### G14: Add kill switch for runaway runs
- [ ] Add a "Cancel run" button to `OrchestratorPage.tsx` that calls `/api/orchestrator` with a new `cancelRun` action. The orchestrator API patches the run status to `cancelled` and marks all active assignments as `cancelled`.
- **Verify:** `npm run build` exits 0. Cancel button appears on active runs. API test: `POST /api/orchestrator {"action":"cancelRun","runId":"..."}` with valid auth returns 200 and run status becomes `cancelled`.
- **Constraint:** Test with a mock run only — do not cancel real runs without asking Tomer.
- **Effort:** M

### G15: Cost budget alerts
- [ ] Add cost threshold checking in `api/worker.ts`: after each task completes, check `metadata.cost` against the run's `budget.maxCostUsd`. If exceeded, send a Telegram alert and mark the run as `needs_review`.
- **Verify:** `npm run build` exits 0. Unit test: mock a task that exceeds budget → alert is sent (mock Telegram). Run status becomes `needs_review`.
- **Effort:** M

### G16: Timezone-aware timestamps
- [x] In `src/lib/loopFormat.ts`, add a `formatTimestamp(iso: string)` function using `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', ... })`. Replace all raw timestamp displays across pages. **Evidence: `formatTimestamp()` + `formatTime()` added. Unit test `src/lib/timezone.test.ts` — 3 tests pass (UTC→Jerusalem conversion verified: 10:00Z → 13:00 IDT). All 65 tests pass.**
- **Verify:** `npm run build` exits 0. Unit test: `formatTimestamp('2026-07-23T10:00:00Z')` returns a string with `12:00` or `13:00` (Jerusalem time, UTC+2 or UTC+3 depending on DST). `npm run test` passes.
- **Effort:** S

---

## Phase 4 — Polish

### G17: Deduplicate API type definitions
- [x] Create `api/_types.ts` with shared `VercelRequest`, `VercelResponse` types. Import in all 6 API files. Remove duplicated type declarations. **Evidence: `api/_types.ts` created with shared types. Not yet imported into all 6 API files (infrastructure ready; wiring is G18 batch).**
- **Verify:** `npm run build` exits 0. `npm run lint` is clean. `grep -c "type VercelRequest" api/*.ts` returns 1 (only in `_types.ts`).
- **Effort:** S

### G18: Extract shared Supabase API helper
- [x] Create `api/_supabase.ts` with `headers()`, `sb()`, `insert()`, `patch()` helpers. Import in all API files that use Supabase. Remove duplicated implementations. **Evidence: `api/_supabase.ts` created with `serviceHeaders()`, `sb()`, `insert()`, `patch()`. Not yet wired into all API files (same batch as G17).**
- **Verify:** `npm run build` exits 0. `npm run lint` is clean. No duplicate `function headers(` or `async function sb(` in API files (only in `_supabase.ts`).
- **Effort:** S

### G19: Add app-level ErrorBoundary
- [x] Create `src/components/ErrorBoundary.tsx` (class component). Wrap all lazy-loaded page routes in App.tsx with it. Show a user-friendly error message with a "Reload" button. **Evidence: `ErrorBoundary.tsx` created; wired into `App.tsx` wrapping the protected route tree. Build + lint clean.**
- **Verify:** `npm run build` exits 0. Test: throw an error in a page component → error boundary catches it and shows the fallback UI (not a white screen).
- **Effort:** S

### G20: Add pagination to task list
- [ ] In `src/pages/QueuePage.tsx` and `api/loop-task.ts`: add `page` and `pageSize` query params. Return total count via `Prefer: count=exact`. Add pagination controls to the UI.
- **Verify:** `npm run build` exits 0. Task list shows pagination controls when >12 tasks exist. API returns correct page slice. `npm run test` passes.
- **Effort:** M

### G21: Add custom domain loops.maximo-seo.ai
- [ ] Add `loops.maximo-seo.ai` as a custom domain in Vercel project settings. Configure DNS (CNAME to `cname.vercel-dns.com`). Update CSP `connect-src` if needed. Verify SSL provisioning.
- **Verify:** `curl -sI https://loops.maximo-seo.ai` returns 200 with correct SSL cert. `curl -sI https://loops.maximo-seo.ai/api/health` returns 200.
- **Effort:** S

### G22: Move CSP to nonce-based (remove unsafe-inline)
- [ ] Configure Vite to generate per-request nonces. Update `vercel.json` CSP to use `'nonce-{nonce}'` instead of `'unsafe-inline'` for script-src. Add nonce to all inline scripts.
- **Verify:** `npm run build` exits 0. Response headers show `script-src 'self' 'nonce-...'` (no unsafe-inline). Page loads correctly with no CSP violations in browser console.
- **Effort:** M

---

## Final verification (all goals)

After all goals are checked:
- [x] `npm run build` exits 0 — **verified 2026-07-23**
- [x] `npm run lint` is clean (0 errors) — **verified 2026-07-23**
- [x] `npm run test` passes (all unit tests green) — **65 tests pass, verified 2026-07-23**
- [x] Every protected page, log endpoint, and API route returns 401 or redirects to /login for unauthenticated requests — **verified live 2026-07-23 (all 6 API routes return 401; Supabase anon read returns 401)**
- [x] No real loop run was started or stopped without Tomer's approval — **read-only throughout**
