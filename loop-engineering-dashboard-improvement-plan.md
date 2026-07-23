# Loop Engineering Dashboard — Improvement Plan

**Date:** 2026-07-23  
**Prepared by:** Hermes Agent (automated audit)  
**Repository:** `maximoseo/loop-engineering-dashboard` (GitHub → Vercel)  
**Live app:** https://loop-engineering-dashboard.vercel.app  
**Priority focus:** (1) Design upgrade, (2) Authentication hardening

---

## 1. Executive Summary

The Loop Engineering Dashboard is a **well-architected Vite + React 19 + Supabase** application that monitors an iterative AI coding loop system (observe → score → learn → propose → test → activate). It includes a serverless task queue with real SEO/UX audit execution via Firecrawl + OpenRouter LLMs, multi-agent orchestration, and Telegram alerting.

**The security architecture is significantly better than typical dashboards at this stage.** All 6 API routes properly return 401 for unauthenticated requests (verified live). RLS policies are fail-closed at the database level — public/anon reads return 401 (verified live). The service-role key is not leaked into the client bundle. Security headers (CSP, HSTS, X-Frame-Options) are properly configured.

However, there are **three real gaps** that need attention:

| # | Finding | Severity | Impact |
|---|---------|----------|--------|
| **S1** | Open `/signup` page allows account creation if Supabase email signup is enabled | **High** | Anyone can create an auth account; though RLS restricts data to one hardcoded email, the signup surface itself is an attack vector and a UX confusion |
| **S2** | RLS authorizes via a single hardcoded email (`service@maximo-seo.com`) | **Medium** | Not scalable; adding operators requires a DB migration; if the email changes, dashboard breaks silently |
| **S3** | No rate limiting on the Supabase auth login endpoint | **Medium** | Brute-force attacks on the password are not throttled at the app layer (Supabase has platform-level protection, but defense-in-depth is missing) |

**For design:** The app has a competent dark theme with a purple/cyan accent system and a polished login page, but the rest of the dashboard suffers from **50KB+ of unstructured CSS**, inconsistent component styling between pages, no reusable design-system components, and the signup page looks unfinished compared to the login page.

**Top 5 highest-impact improvements:**
1. Remove or gate the `/signup` page — this is an internal operator tool, not a public app
2. Extract a component-based design system (shadcn/ui or equivalent) to replace the 50KB CSS blob
3. Unify the login/signup/password pages under one consistent design language
4. Replace the hardcoded RLS email with a `loop_operators` table or Supabase role-based access
5. Add a custom domain (`loops.maximo-seo.ai`) to match your other dashboards

---

## 2. Access Check Results

| Item | Status | Notes |
|------|--------|-------|
| **Vercel** | ✅ Full access | `VERCEL_API_KEY` works. Project `loop-engineering-dashboard` (ID: `prj_ZxhjNojIMoofvPwgeaWkbyzSzSTa`). Can view deployments, env vars (names; sensitive values are encrypted and not readable via API — by design), domains, build settings. Framework: Vite. |
| **GitHub** | ✅ Full access | `GITHUB_PAT` works. Repo: `maximoseo/loop-engineering-dashboard`. Default branch: `main`. Full code read access. Latest commit: `05a6280`. |
| **Supabase** | ✅ Access via code + partial API | Project: `wtpczvyupmavzrxisvcm.supabase.co`. Schema fully readable from migration files (8 migrations). **Note:** The service-role key in Doppler returns 401 — it appears stale or mismatched with the deployed key. The deployed keys work correctly (API routes respond properly). Cannot read sensitive env values via Vercel API (security feature). |
| **Live app — login** | ⚠️ **BLOCKED** | **No credentials were provided** in the task. Furthermore, Supabase Auth reports **0 registered users**. I cannot browse authenticated screens or capture screenshots of the dashboard interior. The design audit below is based on the login page (captured) + full source code analysis. **I need credentials or a created account to complete the visual audit.** |
| **Custom domain** | ❌ Not attached | Only `loop-engineering-dashboard.vercel.app` (default). Your other dashboards use `*.maximo-seo.ai`. **Recommendation: add `loops.maximo-seo.ai`.** |

---

## 3. Current State

### Stack
- **Frontend:** Vite 8 + React 19 + React Router 7 + Tailwind CSS 4 + Recharts 3 + Zod 4
- **Backend:** Vercel Serverless Functions (TypeScript) + Supabase (Postgres + Auth + Realtime)
- **External APIs:** Firecrawl (web scraping), OpenRouter (LLM calls), Telegram Bot API (alerts)
- **Monitoring:** Sentry (frontend DSN configured)
- **Testing:** Vitest (unit) + Playwright (E2E)

### Architecture
```
Browser (SPA)
  ├── React Router → ProtectedRoute (client-side auth gate)
  ├── Supabase client (auth session in localStorage, auto-refresh)
  ├── REST reads via Supabase JS (using access token as bearer)
  └── Realtime subscription (postgres_changes on 4 tables)

Vercel Serverless API (6 routes):
  ├── /api/health     — liveness + readiness (no auth, intentional)
  ├── /api/loop-task  — task queue CRUD (Supabase auth + operator allowlist)
  ├── /api/orchestrator — multi-agent run management (auth + operator/worker dual)
  ├── /api/proposal-approve — proposal decisions (auth + approver allowlist)
  ├── /api/worker     — cron-triggered task processor (CRON_SECRET / WORKER_SECRET)
  └── /api/notify     — internal notification relay (ORCHESTRATOR_WORKER_TOKEN)

Supabase:
  ├── 22 loop_* tables with RLS
  ├── Auth (email/password)
  ├── Realtime publication
  └── Security definer functions (apply_loop_proposal_decision)
```

### How run data flows in
- **Task queue:** Dashboard POSTs to `/api/loop-task` → inserts into `loop_task_handoffs` → kicks `/api/worker` → Vercel Cron runs `/api/worker` every minute → worker claims tasks, runs Firecrawl + LLM audits, writes results back
- **Orchestrator:** Dashboard POSTs to `/api/orchestrator` (action: createRun) → creates project + run + assignments → workers lease and complete assignments
- **Realtime:** Browser subscribes to `postgres_changes` on `loop_state`, `loop_scores`, `loop_proposals`, `loop_orchestrator_runs` — triggers debounced refetch on changes
- **Polling fallback:** 30-second interval refetch as backup if realtime fails

### What already works well
1. **Security architecture is solid** — fail-closed design throughout API routes and RLS
2. **Atomic task claiming** — guarded PATCH prevents duplicate processing
3. **Dead-letter queue** — tasks that stall 3+ times are dead-lettered, not retried forever
4. **Cost tracking** — per-task Firecrawl credits + LLM token usage recorded in metadata
5. **Structured logging** — JSON logger with PII-safe fields
6. **CSP headers** — properly restrictive (no wildcard script-src, frame-src none)
7. **Realtime + polling** — dual data freshness strategy
8. **Input validation** — Zod schemas on all API inputs

---

## 4. Design Upgrade Plan

### Current design assessment (from code + login screenshot)

**Strengths:**
- Dark theme with a cohesive purple (`#8b5cf6`) + cyan (`#06b6d4`) accent system
- CSS custom properties are well-organized (backgrounds, borders, accents, status, text)
- Login page is polished: gradient orbs, glassmorphism card, animated brand mark, gradient submit button
- Responsive media queries throughout
- `prefers-reduced-motion` respected
- Focus-visible outlines defined
- Status color system (good/warn/bad/info) with semantic classes

**Problems (evidence-based):**

| Issue | Evidence | Impact |
|-------|----------|--------|
| **50KB+ CSS in one file** | `src/index.css` is ~50,105 bytes with 480+ lines omitted in audit output | Unmaintainable; no component isolation; changes risk cascading breakage |
| **No design system components** | No `ui/` directory, no shadcn/ui, no Headless UI — just raw `<div className="glass">` everywhere | Inconsistent spacing, borders, shadows across pages; no reusable primitives |
| **Signup page is unfinished** | Uses generic `.glass rounded-xl p-8` — completely different from the polished login page with `.login-card`, `.login-orb`, `.login-mark` | Jarring inconsistency; looks like two different apps |
| **Forgot/Reset password pages** | Likely same generic styling as signup (not audited in depth, but pattern matches) | Same inconsistency |
| **Status color unconventional** | `--success: #22d3ee` (cyan) instead of green — cyan is typically an "info" color | Confusing semantics; users expect green = success |
| **No chart theming** | Recharts uses default styling; no custom tooltip, no consistent color mapping to the purple/cyan palette | Charts look generic, not branded |
| **Monospace font for data** | JetBrains Mono loaded but usage inconsistent — some data uses sans, some mono | Reduces scannability of tabular data |
| **No RTL support** | All LTR; user is Hebrew-speaking but this is an internal tool so English UI is acceptable | Low priority — internal operator tool |

### Proposed design direction

**Recommended: "Refined Dark Control Room"** — evolve the existing dark theme, don't replace it.

**Design tokens:**
- **Palette:** Keep the purple/cyan accent but fix the semantics:
  - `--success` → `#34d399` (emerald green, WCAG AA on dark bg)
  - `--info` → `#22d3ee` (cyan, for neutral information)
  - `--warning` → `#fbbf24` (amber, keep)
  - `--error` → `#f87171` (red, keep)
  - `--accent` → deepen to `#7c3aed` (more purple per user preference) with `--accent-bright: #a78bfa`
- **Typography:** Inter for UI, JetBrains Mono for all data/metrics/code/logs
- **Spacing:** 4px base unit (Tailwind default)
- **Radii:** Consistent scale — `sm: 8px`, `md: 12px`, `lg: 16px`, `xl: 20px`
- **Borders:** Use `--border-subtle` (0.12 opacity) for inner dividers, `--border-default` (0.20) for card edges

**Component approach:**
- **Add shadcn/ui** (Radix primitives + Tailwind) for: Button, Input, Card, Dialog, Toast, Badge, Select, Tabs, Tooltip
- This replaces the 50KB CSS blob with composable, accessible, themeable components
- Keep the existing `.login-*` classes (they're good) but extract into a reusable `<AuthCard>` component

**Screen-by-screen redesign notes:**

| Screen | Current | Change |
|--------|---------|--------|
| **Login** | ✅ Polished | Keep as-is; extract into `<AuthLayout>` for reuse |
| **Signup** | Generic `.glass` | Redesign to match login page using `<AuthLayout>` |
| **Forgot/Reset password** | Likely generic | Same — use `<AuthLayout>` |
| **Dashboard overview** | `overview-shell` grid | Replace raw CSS with shadcn `<Card>` components; add proper chart theming |
| **Task queue** | Table + drawer | Add virtualization for long lists; monospace for task IDs; status badges with fixed-width icons |
| **Orchestrator** | Agent lanes | Improve run timeline visualization; add progress bars per assignment |
| **Analytics** | Recharts defaults | Custom theme: purple/cyan series colors, dark tooltips, grid lines at 10% opacity |
| **Cost** | Metrics cards | Add budget progress bars; color-code over-budget states |
| **All pages** | Mixed styling | Unify card/pill/badge components via shadcn |

### Alternative design directions (for reference)

| Direction | Pros | Cons |
|-----------|------|------|
| **A: Refined Dark (recommended)** | Low risk; evolves existing work; preserves brand | Still dark-heavy; may feel similar to current |
| **B: Light + Purple** | Fresh; better for long sessions; matches some Maximo brand materials | Complete rewrite; loses the "control room" feel |
| **C: High-contrast minimal** | Maximum accessibility; very Linear/Vercel-like | May feel too plain for a monitoring tool |

---

## 5. Authentication Hardening Plan

### Protection coverage test results (verified live, 2026-07-23)

| Endpoint | Method | Unauthenticated result | Status |
|----------|--------|----------------------|--------|
| `/api/health` | GET | 200 (intentional — health check) | ✅ OK |
| `/api/loop-task` | GET | **401** | ✅ Protected |
| `/api/loop-task?includeTasks=true` | GET | **401** | ✅ Protected |
| `/api/loop-task` | POST | **401** | ✅ Protected |
| `/api/orchestrator` | GET | **401** | ✅ Protected |
| `/api/orchestrator` (createRun) | POST | **401** | ✅ Protected |
| `/api/proposal-approve` | POST | **401** | ✅ Protected |
| `/api/worker` | GET | **401** | ✅ Protected |
| `/api/worker` | POST | **401** | ✅ Protected |
| `/api/notify` | POST | **401** | ✅ Protected |
| **Supabase REST (anon key)** | GET loop_state | **401** (permission denied) | ✅ RLS blocks anon |
| **Supabase REST (no key)** | GET loop_state | **401** | ✅ Blocked |

**Verdict: All API routes and database tables are properly protected.** No data leaks without authentication.

### SPA page protection

Pages (`/dashboard`, `/queue`, `/orchestrator`) return HTTP 200 with the SPA shell — this is expected behavior for a client-side routed SPA. The actual protection is in `ProtectedRoute` (App.tsx), which redirects to `/login` when no session exists. This is correct for an SPA.

### Auth implementation review

| Area | Status | Notes |
|------|--------|-------|
| **Middleware/route protection** | ✅ Good | `ProtectedRoute` gates all authenticated routes; `initializing` flag prevents flash of login redirect |
| **Session handling** | ✅ Good | Supabase session in localStorage, auto-refresh enabled, `detectSessionInUrl: false` (prevents OAuth redirect attacks) |
| **Token verification (API)** | ✅ Good | `authenticateSupabaseUser()` calls Supabase Auth API to verify the bearer token on every API request |
| **Operator/approver allowlists** | ✅ Good | `LOOP_OPERATOR_EMAILS` and `LOOP_APPROVER_EMAILS` env vars gate operational actions; empty fails closed |
| **Worker auth** | ✅ Good | Separate `WORKER_SECRET` / `CRON_SECRET` / `ORCHESTRATOR_WORKER_TOKEN`; secrets in headers, never query params |
| **Password recovery flow** | ✅ Good | `PASSWORD_RECOVERY` event redirects to `/reset-password`; hardcoded path (no open redirect) |
| **RLS policies** | ✅ Good | Fail-closed; anon has zero privileges; authenticated is read-only; writes via service-role API only |
| **Secret redaction in logs** | ✅ Good | Logger explicitly documents PII-safe fields; only taskId/runId/assignmentId logged |

### Vulnerabilities and hardening recommendations

#### S1 — Open signup page (HIGH)

**What:** The `/signup` route exists and calls `supabase.auth.signUp()`. If Supabase Auth has "Enable email signup" enabled (the default), anyone can create an auth account.

**Why it matters:** This is an internal operator tool. Allowing public account creation:
- Creates an attack surface (account enumeration, credential stuffing setup)
- Confuses users (why can anyone sign up for an internal tool?)
- Although RLS restricts data access to the hardcoded email, the signup itself wastes resources and looks unprofessional

**How to fix:** Remove the `/signup` route entirely. Create accounts via the Supabase dashboard or a CLI script. If self-service signup is needed, gate it behind an invite token.

**Effort:** S | **Priority:** High

#### S2 — Hardcoded RLS email (MEDIUM)

**What:** `loop_dashboard_authorized()` hardcodes `service@maximo-seo.com`. All RLS read policies call this function.

**Why it matters:** Adding a second operator requires a database migration. If the email changes, the dashboard silently breaks (all reads return empty). Not auditable (no record of who has access).

**How to fix:** Create a `loop_operators` table `(user_id uuid references auth.users, role text)`. Replace the function to check membership:
```sql
select exists (
  select 1 from public.loop_operators
  where user_id = auth.uid()
);
```

**Effort:** M | **Priority:** Medium

#### S3 — No rate limiting on auth login (MEDIUM)

**What:** The Supabase auth endpoint (`/auth/v1/token?grant_type=password`) has no application-level rate limiting. Rate limiting exists only on `/api/loop-task` POST.

**Why it matters:** Supabase has platform-level brute-force protection, but defense-in-depth means the app should also throttle login attempts. Without it, a determined attacker could try many passwords.

**How to fix:** Add a Vercel Edge Middleware or a serverless function wrapper that rate-limits auth attempts by IP (e.g., 5 attempts per minute, exponential backoff after 3 failures).

**Effort:** M | **Priority:** Medium

#### S4 — Stale Doppler service-role key (LOW)

**What:** The `SUPABASE_SECRET_KEY` / `SUPABASE_DB_PASSWORD` in Doppler returns 401 when used against the deployed Supabase project.

**Why it matters:** Secrets management is out of sync. If someone uses the Doppler key for automation or backups, it will fail silently.

**How to fix:** Update Doppler secrets to match the deployed Supabase project's current keys. Verify with a read test.

**Effort:** S | **Priority:** Low

#### S5 — No MFA option (LOW)

**What:** Supabase Auth supports MFA (TOTP), but it's not enabled or prompted.

**Why it matters:** This dashboard can trigger real API costs (Firecrawl, OpenRouter) and manage multi-agent runs. A compromised account has real financial impact.

**How to fix:** Enable MFA enrollment in Supabase Auth settings. Add a UI prompt for operators to set up TOTP.

**Effort:** M | **Priority:** Low

---

## 6. Other Findings & Recommendations

### Data & Dashboard Correctness

| ID | Finding | Why it matters | Fix | Effort | Priority |
|----|---------|---------------|-----|--------|----------|
| D1 | Timestamps stored as UTC, displayed without timezone conversion | User is in Asia/Jerusalem; times may appear wrong | Add timezone-aware formatting (Intl.DateTimeFormat with `timeZone: 'Asia/Jerusalem'`) | S | Med |
| D2 | 30s polling + realtime may cause duplicate fetches | Wasted API calls; potential race conditions | Debounce is already 1.2s — consider increasing to 2s or deduplicating in-flight requests | S | Low |
| D3 | `process` column stored as `jsonb` but some code paths write `JSON.stringify()` | Double-encoding; may cause parsing errors | Ensure all inserts use objects, not stringified JSON | S | Med |

### Code Quality

| ID | Finding | Why it matters | Fix | Effort | Priority |
|----|---------|---------------|-----|--------|----------|
| C1 | 50KB CSS in single `index.css` | Unmaintainable; high cognitive load | Extract to component-scoped CSS or migrate to shadcn/ui | L | High |
| C2 | VercelRequest/Response types duplicated in every API file | DRY violation; 6 copies of the same types | Create `api/_types.ts` and import | S | Med |
| C3 | Supabase fetch helper duplicated across API files | Same `headers()`, `sb()` pattern repeated 4x | Extract to `api/_supabase.ts` | S | Med |
| C4 | No error boundary at app level | A single component crash takes down the whole app | Add `<ErrorBoundary>` wrapper in App.tsx | S | Med |
| C5 | `PanelBoundary` exists but unclear if used everywhere | Partial error isolation | Audit usage; ensure all lazy-loaded pages are wrapped | S | Low |

### Security (beyond auth)

| ID | Finding | Why it matters | Fix | Effort | Priority |
|----|---------|---------------|-----|--------|----------|
| S6 | CSP includes `script-src 'unsafe-inline'` | Allows XSS if any user input reaches the DOM | Move to nonce-based CSP (Vite supports this); remove unsafe-inline | M | Med |
| S7 | `connect-src` includes `https://api.telegram.org` | Browser can make direct Telegram API calls | This is for worker notifications; should be server-side only. Remove from CSP if frontend doesn't call it directly | S | Low |
| S8 | Supabase URL and anon key in client bundle | Expected for Supabase (anon key is public by design) | ✅ No action needed — this is correct |

### Performance

| ID | Finding | Why it matters | Fix | Effort | Priority |
|----|---------|---------------|-----|--------|----------|
| P1 | No Lighthouse score captured (vision model unavailable) | Can't measure baseline | Run Lighthouse manually after design upgrade | S | Med |
| P2 | No pagination on task list (`limit=12` hardcoded) | With many tasks, list truncates silently | Add pagination or infinite scroll | M | Med |
| P3 | No virtualization on long lists (logs, events) | Large transcripts/logs will lag the DOM | Add `react-window` or similar for lists >100 items | M | Low |
| P4 | Google Fonts loaded synchronously | Render-blocking | Add `font-display: swap` (already in URL) ✅; consider self-hosting | S | Low |

### Functionality

| ID | Finding | Why it matters | Fix | Effort | Priority |
|----|---------|---------------|-----|--------|----------|
| F1 | No kill switch for runaway loops | A stuck run burns API budget indefinitely | Add a "cancel run" button that patches status to 'cancelled' | M | High |
| F2 | No cost budget alerts | Costs can accumulate without warning | Add threshold alerts (Slack/Telegram) when run cost exceeds budget | M | Med |
| F3 | No run comparison view | Can't compare iteration N vs N-1 | Add a diff/comparison panel | L | Low |
| F4 | No export functionality for logs/results | Can't archive or share audit results | CSV/JSON export already partially built (`exportCsv.ts`) — wire it up | S | Low |

### Feature Opportunities (prioritized)

| Feature | Description | Effort | Priority |
|---------|-------------|--------|----------|
| **Kill switch** | One-click cancel for runaway runs | M | High |
| **Cost dashboard with budgets** | Per-run and per-project cost tracking with threshold alerts | M | High |
| **Live log streaming** | WebSocket/SSE for real-time log tailing instead of polling | L | Med |
| **Goal-checklist progress** | Visual progress bars for goal completion per run | S | Med |
| **Failure alerts (Slack/email)** | Instant notification when a run fails | M | Med |
| **Success-rate stats** | Avg iterations to done, success rate over time | S | Med |
| **Per-project grouping** | Group runs by project instead of flat list | M | Low |
| **History & replay** | Replay a past run's iterations step by step | L | Low |

---

## 7. Roadmap

### Phase 0 — Security fixes (before any design work)
1. **S1:** Remove or gate the `/signup` page
2. **S4:** Sync Doppler secrets with deployed Supabase keys
3. **S3:** Add rate limiting on auth login

### Phase 1 — Design system foundation
4. **C1:** Install shadcn/ui; extract design tokens
5. Unify auth pages (login/signup/forgot/reset) under `<AuthLayout>`
6. Fix status color semantics (success = green)

### Phase 2 — Design upgrade
7. Redesign dashboard overview with shadcn components
8. Custom Recharts theme
9. Improve task queue UX (monospace IDs, status badges, virtualization)
10. Improve orchestrator run timeline

### Phase 3 — Hardening & features
11. **S2:** Replace hardcoded RLS email with `loop_operators` table
12. **S5:** Enable MFA
13. **F1:** Add kill switch
14. **F2:** Cost budget alerts
15. **D1:** Timezone-aware timestamps

### Phase 4 — Polish
16. **C2-C4:** Code quality (type dedup, error boundary, helper extraction)
17. **P2-P3:** Pagination and virtualization
18. Custom domain: `loops.maximo-seo.ai`
19. **S6:** Nonce-based CSP

---

## 8. Open Questions

1. **Login credentials:** I need email + password to browse authenticated screens and capture screenshots for the design audit. Currently 0 users exist in Supabase Auth. Should I create one, or will you provide existing credentials?
2. **Supabase Auth signup setting:** Is "Enable email signup" currently on or off in your Supabase project? This determines whether S1 is an active vulnerability or just a code smell.
3. **Who are the operators?** Beyond `service@maximo-seo.com`, are there other emails that should have access? This affects the S2 fix design.
4. **Custom domain:** Should I proceed with `loops.maximo-seo.ai` in Phase 4, or do you prefer a different subdomain?
5. **LOOP_TASK_PUBLIC_ENABLED:** What is this set to in production? If `false`, the task queue is effectively read-only (no new tasks can be submitted). This affects whether the QuickLaunch UI works.
6. **Is the Telegram alerting active?** The worker sends Telegram messages on task completion. Is `TELEGRAM_CHAT_ID` pointed at your chat?
