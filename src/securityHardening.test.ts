import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('workspace security migration', () => {
  const migration = source('supabase/migrations/20260724060000_workspace_tenancy_and_atomic_promotion.sql')
  const rolloutCleanup = source('supabase/migrations/20260724061000_drop_legacy_workspace_defaults.sql')

  it('scopes rows and child ownership to a workspace', () => {
    expect(migration).toContain('create table public.loop_workspace_members')
    expect(migration).toContain('public.loop_workspace_authorized(workspace_id)')
    expect(migration).toContain('foreign key(workspace_id, task_id)')
    expect(migration).toContain('foreign key(workspace_id, run_id)')
    expect(migration).not.toMatch(/to authenticated using \(true\)/)
  })

  it('promotes proposals with a locked tenant row and passed evaluations', () => {
    expect(migration).toContain('for update;')
    expect(migration).toContain("proposal.eval_summary ->> 'passed'")
    expect(migration).toContain("return 'evaluation_required'")
    expect(migration).toContain('insert into public.loop_activations(workspace_id')
    expect(migration).toContain('public.transition_loop_proposal(')
    const activation = source('scripts/activate_or_rollback.py')
    expect(activation).toContain('transition_loop_proposal')
    expect(activation).toContain('revert_change(proposal, snap_path)')
    expect(activation).toContain('compensated file after DB failure')
  })

  it('supports a backward-compatible two-phase production rollout', () => {
    expect(migration).toContain("add column workspace_id uuid default %L::uuid")
    expect(rolloutCleanup).toContain('alter column workspace_id drop default')
  })

  it('ships explicit rollback guidance', () => {
    expect(source('docs/migrations/20260724060000_workspace_tenancy_and_atomic_promotion.rollback.md')).toContain('point-in-time restore')
  })
})

describe('bounded and non-gameable automation', () => {
  it('pins Vercel to the supported Node LTS runtime', () => {
    const packageJson = JSON.parse(source('package.json')) as { engines?: { node?: string } }
    expect(packageJson.engines?.node).toBe('22.x')
  })

  it('requires worker ownership and workspace filters', () => {
    const api = source('api/orchestrator.ts')
    expect(api).toContain('lease_owner=eq.${encodeURIComponent(worker_id)}')
    expect(api).toContain('workspace_id=eq.${workspace_id}')
    expect(source('api/schemas.ts')).toMatch(/assignmentId: IdSchema,\s+workerId: IdSchema/)
  })

  it('bounds provider calls and validates LLM judge JSON', () => {
    const worker = source('api/worker.ts')
    expect(worker).toContain('MAX_PROVIDER_RESPONSE_BYTES')
    expect(worker).toContain('AbortSignal.timeout(PROVIDER_TIMEOUT_MS)')
    expect(worker).toContain('Math.min(3')
    expect(source('scripts/score.py')).toContain('validate_object(ask_json')
    expect(source('scripts/run_evals.py')).toContain('"passed": passed')
    expect(source('scripts/extract_lessons.py')).toContain('validate_lessons(ask_json')
    expect(source('scripts/propose.py')).toContain('validate_object(ask_json')
  })

  it('does not persist auth or task material in localStorage', () => {
    const browser = source('src/lib/supabase.ts')
    expect(browser).toContain("storage: typeof sessionStorage")
    expect(browser).not.toMatch(/storage:\s*localStorage/)
  })
})
