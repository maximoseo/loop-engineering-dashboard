# Loop Engineering Dashboard — תוכנית שיפור מלאה

**תאריך:** 2026-07-07  
**Repo קיים:** `maximoseo/loop-engineering-dashboard`  
**GitHub URL:** https://github.com/maximoseo/loop-engineering-dashboard  
**Branch יעד:** `main`  
**Production Dashboard קיים:** https://loop-engineering-dashboard.vercel.app  
**Vercel Project:** `loop-engineering-dashboard` תחת scope/team `maximo-seo`  
**סטטוס נוכחי:** repo קיים, deployment פעיל, HTTP 200, Vercel Ready

---

## 1. תשובה ישירה — האם השינויים יהיו על הקיים?

כן. התוכנית מיועדת לעבוד על **ה־repo הקיים** ועל **הדשבורד הקיים** בלבד:

| רכיב | יעד עבודה |
|---|---|
| GitHub | `maximoseo/loop-engineering-dashboard` |
| Branch | `main`, או branch feature שיוחזר ב־PR ל־`main` |
| Vercel Project | `loop-engineering-dashboard` הקיים |
| Production URL | `https://loop-engineering-dashboard.vercel.app` |
| Dashboard of Dashboards | להוסיף/לוודא כרטיס שמצביע ל־production URL הקיים |

לא מתוכנן ליצור repo חדש או דשבורד חדש, אלא לשדרג את מה שכבר קיים.

### מגבלת גישה כרגע

- ל־Vercel יש גישה מאומתת דרך CLI.
- ל־GitHub יש כרגע קריאה בלבד כי ה־repo Public.
- כדי לעשות push/PR בפועל צריך לחבר GitHub CLI עם token.

---

## 2. מה אומת בפועל לפני כתיבת התוכנית

### GitHub

נבדק read-only:

```bash
git ls-remote https://github.com/maximoseo/loop-engineering-dashboard.git
```

נמצא branch:

```text
main
```

נמצא commit ראשי בזמן הבדיקה:

```text
017b442 Fix improvement card title: case-insensitive SKILL.md replace + slash regex
```

### Vercel

נבדק:

```bash
vercel inspect https://loop-engineering-dashboard.vercel.app
```

תוצאה:

```text
name: loop-engineering-dashboard
target: production
status: Ready
alias: https://loop-engineering-dashboard.vercel.app
```

בדיקת HTTP:

```text
HTTP 200
server: Vercel
title: Loop Engineering Dashboard | Maximo SEO
```

---

## 3. מצב טכני נוכחי של ה־repo

### Stack

| Layer | טכנולוגיה |
|---|---|
| UI | React 19 |
| Language | TypeScript 6 |
| Build | Vite 8 |
| CSS | Tailwind CSS 4 |
| Hosting | Vercel |
| Data | Supabase read-only dashboard polling |

### Scripts קיימים

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

### קבצים מרכזיים

| קובץ | תפקיד |
|---|---|
| `src/App.tsx` | Layout ראשי של הדשבורד |
| `src/data/liveData.ts` | קריאת Supabase ותרגום state ל־UI |
| `src/data/mockData.ts` | fallback/demo state |
| `src/components/*` | כרטיסים ו־widgets |
| `scripts/loopctl.py` | שליטה בלולאת Observe/Score/Learn/Improve |
| `scripts/observe.py` | איסוף sessions |
| `scripts/score.py` | scoring |
| `scripts/extract_lessons.py` | הפקת lessons |
| `scripts/propose.py` | הצעות שיפור |
| `scripts/run_evals.py` | regression evals |
| `scripts/activate_or_rollback.py` | activation/rollback |
| `LOOP_ENGINEERING_PLAN.md` | ארכיטקטורת המערכת הנוכחית |

---

## 4. מטרת השיפור

להפוך את הדשבורד מ־read-only visualization בסיסי ל־**Mission Control מלא ללולאות שיפור סוכנים**:

1. להראות בבירור מה מצב הלולאה עכשיו.
2. להציג איכות, סיכונים, failures, rollbacks, proposals ו־evals בצורה ניהולית.
3. להוסיף יכולת drill-down להבנת כל iteration/proposal.
4. להבטיח שהנתונים חיים ולא demo בטעות.
5. לשלב אותו נכון ב־Dashboard of Dashboards.
6. לשפר production reliability, accessibility, mobile UX ובדיקות.

---

## 5. עקרונות ביצוע

1. **לא יוצרים דשבורד חדש** — עובדים על הקיים.
2. **לא שוברים את ה־production URL** — ה־alias הקיים נשאר.
3. **אין public mutation endpoint** — הדשבורד נשאר read-only, אלא אם תאשר אחרת.
4. **כל שינוי עובר lint/build/QA לפני דיווח הצלחה.**
5. **סודות נשארים מחוץ ל־repo** — רק env מאובטח ב־Vercel או local secure files.
6. **Dashboard of Dashboards יצביע ל־production dashboard**, לא ל־Vercel admin.

---

## 6. Phase 1 — Product / UX שדרוג

### 6.1 Information Architecture

להפוך את המסך ל־4 אזורי עבודה ברורים:

1. **Mission Control Hero**
   - current phase
   - loop running / idle
   - live/demo badge
   - last refresh
   - health score
   - next scheduled run

2. **Quality & Risk Overview**
   - avg score 7d
   - rollback rate
   - eval pass rate
   - open failures
   - pending approvals

3. **Operational Feed**
   - recent iterations
   - recent proposals
   - recent activations / rollbacks
   - failed evals

4. **Investigation Panels**
   - failure library
   - optimization backlog
   - eval results
   - proposal detail drawer

### 6.2 UI Components לשיפור

| Component | שיפור מוצע |
|---|---|
| `HeroPhase` | להוסיף status strip, live/demo badge בולט, phase SLA |
| `MetricsSummary` | להוסיף trend arrows, severity colors, thresholds |
| `PhaseTimeline` | להוסיף timestamps, stuck phase detection |
| `ScoreChart` | tooltip, 7d/30d toggle, score caps visualization |
| `ImprovementFeed` | filters לפי status/risk/type |
| `EvalResults` | grouping לפי safety/general/productivity |
| `IterationTimeline` | detail drawer לכל session/task |
| `FailureLibrary` | severity + recurrence + mitigation |
| `OptimizationBacklog` | priority queue + approval status |
| `Sidebar` | navigation anchors + health summary |

---

## 7. Phase 2 — Data Accuracy & Live-State Hardening

### 7.1 בעיה נוכחית

הדשבורד עושה fallback ל־`mockLoopState` אם אין נתונים חיים. זה טוב ל־demo, אבל מסוכן ב־production כי אפשר לחשוב שהדשבורד חי כשהוא בעצם מציג mock.

### 7.2 שיפור מוצע

להוסיף `DataSourceStatus` גלובלי:

```ts
type DataSourceStatus = {
  mode: 'live' | 'demo' | 'partial' | 'error'
  source: 'supabase' | 'mock'
  lastSuccessfulFetch: string | null
  rowCounts: {
    iterations: number
    scores: number
    proposals: number
    evals: number
    failures: number
  }
  warnings: string[]
}
```

### 7.3 UX נדרש

| מצב | תצוגה |
|---|---|
| `live` | ירוק: Live Supabase Data |
| `partial` | צהוב: Partial data, missing tables/rows |
| `demo` | כתום: Demo fallback active |
| `error` | אדום: Supabase/API error |

### 7.4 בדיקות

- אם Supabase מחזיר 0 rows, ה־UI חייב להציג `DEMO`, לא להתחזות ל־live.
- אם טבלה אחת נכשלת, להציג partial ולא להפיל את כל הדשבורד.
- לוודא שאין console errors.

---

## 8. Phase 3 — Drill-down & Auditability

### 8.1 Iteration Detail Drawer

בלחיצה על iteration:

- task id
- timestamp
- user request sanitized
- tools used count
- duration
- token usage
- score breakdown
- extracted lessons
- linked proposals
- failure pattern אם קיים

### 8.2 Proposal Detail Drawer

בלחיצה על proposal:

- proposal id
- source lessons
- target file/skill/config
- risk level
- eval before/after
- activation status
- rollback status
- reason if rejected/rolled back

### 8.3 Failure Pattern Detail

בלחיצה על failure:

- pattern key
- severity
- frequency
- first seen / last seen
- related iterations
- mitigation
- whether recurrence is improving

---

## 9. Phase 4 — Reliability / Health Layer

להוסיף health contract ברור בדשבורד:

```ts
type LoopHealth = {
  loopStateFresh: boolean
  latestIterationAgeMinutes: number
  latestScoreAgeMinutes: number
  latestEvalAgeHours: number
  failureRecurrenceHigh: boolean
  rollbackRateHigh: boolean
  pendingApprovalCount: number
}
```

### Health cards

| Card | Logic |
|---|---|
| Freshness | last iteration/score/eval age |
| Safety | safety eval failures |
| Stability | rollback rate |
| Learning | lessons extracted per iteration |
| Approval Queue | pending human approvals |

---

## 10. Phase 5 — Dashboard of Dashboards integration

### 10.1 מטרה

להוסיף/לוודא כרטיס בדשבורד המרכזי שמצביע ל:

```text
https://loop-engineering-dashboard.vercel.app
```

ולא ל־Vercel Admin.

### 10.2 Metadata לכרטיס

```json
{
  "id": "loop-engineering-dashboard",
  "name": "Loop Engineering Dashboard",
  "category": "automation",
  "status": "active",
  "productionUrl": "https://loop-engineering-dashboard.vercel.app",
  "githubUrl": "https://github.com/maximoseo/loop-engineering-dashboard",
  "hosting": "vercel",
  "vercelProject": "loop-engineering-dashboard",
  "description": "Self-improving agent loop dashboard for observe/score/learn/propose/test/activate workflows."
}
```

### 10.3 Verification

- dashboard card appears in panel
- clicking card opens production dashboard URL
- source chip GitHub opens repo URL
- source chip Vercel, if shown, opens Vercel project/admin separately
- panel count includes it only once
- panel itself is not counted as managed dashboard

---

## 11. Phase 6 — Documentation improvements

### 11.1 Update existing MD

Update existing `LOOP_ENGINEERING_PLAN.md` instead of replacing it.

Add sections:

- `12. Improvement Roadmap`
- `13. Production QA Checklist`
- `14. Dashboard of Dashboards Integration`
- `15. Access Matrix`
- `16. Known Risks / Open Questions`

### 11.2 Add new roadmap MD

Create:

```text
docs/loop-engineering-dashboard-improvement-roadmap.md
```

If `docs/` does not exist, create it.

### 11.3 README update

Add:

- production URL
- GitHub/Vercel access notes
- local dev
- build/test commands
- deployment verification checklist

---

## 12. Phase 7 — Testing & QA

### 12.1 Local checks

```bash
npm install
npm run lint
npm run build
```

### 12.2 Production checks

```bash
vercel inspect https://loop-engineering-dashboard.vercel.app
curl -I https://loop-engineering-dashboard.vercel.app
```

### 12.3 Browser QA

- desktop viewport
- mobile viewport
- no console errors
- live/demo badge correct
- dashboard cards render
- detail drawers work
- filters work
- source links work

### 12.4 Dashboard of Dashboards QA

- verify card exists
- verify production link
- verify GitHub source link
- verify Vercel source link if applicable
- verify count
- verify no duplicate entry

---

## 13. Security / Secrets

### Must not commit

- Supabase service role key
- Vercel token
- GitHub token
- local `.env`
- `.vercel` sensitive config
- loop runtime data
- session DB

### Public dashboard should remain

- read-only
- anon SELECT only
- no mutation endpoints
- no user/session raw text with secrets
- no raw prompts if not sanitized

---

## 14. Suggested implementation order

1. Connect GitHub CLI with token.
2. Create branch:

```bash
git checkout -b feat/loop-dashboard-improvement-roadmap
```

3. Add roadmap MD under `docs/`.
4. Update `LOOP_ENGINEERING_PLAN.md` with roadmap section.
5. Update README with production/deployment info.
6. Implement small UI/data-source status improvements first.
7. Run lint/build.
8. Commit and push branch.
9. Open PR or merge to `main` if approved.
10. Deploy existing Vercel project.
11. Add/verify Dashboard of Dashboards card.
12. Run live QA and report with links/screenshots.

---

## 15. Definition of Done

The work is complete only when:

- GitHub repo contains the plan/roadmap MD.
- Existing dashboard build passes.
- Existing Vercel deployment is Ready.
- `https://loop-engineering-dashboard.vercel.app` returns HTTP 200.
- Dashboard of Dashboards contains one active card for this dashboard.
- Card opens the production dashboard, not Vercel admin.
- GitHub/Vercel source links are correct.
- No duplicate/stale entries exist.
- Final report includes exact commit/deployment/QA evidence.

---

## 16. Access answer

### Can I work on this?

Yes, technically I can work on it.

### Can I currently write to GitHub?

Not yet. GitHub CLI is installed, but not authenticated. I need a GitHub token/login to push or create a PR.

### Can I currently inspect/manage Vercel?

Yes. Vercel CLI is authenticated and can inspect the existing project/deployment.

### Will changes be on the existing repo/dashboard?

Yes. The target is the existing GitHub repo and the existing Vercel dashboard:

```text
GitHub: maximoseo/loop-engineering-dashboard
Vercel: loop-engineering-dashboard
Production: https://loop-engineering-dashboard.vercel.app
```

---

## 17. Approval gate

Before implementing code/deploy changes, required approval:

1. Connect GitHub auth.
2. Confirm whether to work directly on `main` or via feature branch + PR.
3. Confirm Dashboard of Dashboards repo/path to modify, or let me locate it.
4. Confirm whether to do only documentation first or also UI/product improvements.
