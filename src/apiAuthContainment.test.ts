import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type RecordedResponse = {
  statusCode: number
  body: Record<string, unknown> | null
  headers: Record<string, string>
}

function responseRecorder() {
  const recorded: RecordedResponse = { statusCode: 200, body: null, headers: {} }
  const response = {
    status(code: number) {
      recorded.statusCode = code
      return response
    },
    json(body: unknown) {
      recorded.body = body as Record<string, unknown>
    },
    setHeader(name: string, value: string) {
      recorded.headers[name] = value
    },
  }
  return { response, recorded }
}

const envKeys = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'LOOP_OPERATOR_EMAILS',
  'LOOP_APPROVER_EMAILS',
  'ORCHESTRATOR_WORKER_TOKEN',
] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
  for (const key of envKeys) delete process.env[key]
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const key of envKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('P0 API auth containment', () => {
  it('denies anonymous loop-task status without exposing readiness or task data', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/loop-task.ts')
    const { response, recorded } = responseRecorder()

    await handler({ method: 'GET', headers: {}, query: { includeTasks: 'true' } }, response)

    expect(recorded.statusCode).toBe(401)
    expect(recorded.body).toEqual({ ok: false, message: 'Authentication required.' })
    expect(recorded.body).not.toHaveProperty('deliveryReadiness')
    expect(recorded.body).not.toHaveProperty('tasks')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when an authenticated task submitter has no configured operator allowlist', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1', email: 'operator@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/loop-task.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-session' },
      body: { task: 'Run a focused containment verification.' },
    }, response)

    expect(recorded.statusCode).toBe(403)
    expect(recorded.body).not.toHaveProperty('deliveryReadiness')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('denies anonymous orchestrator reads', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({ method: 'GET', headers: {} }, response)

    expect(recorded.statusCode).toBe(401)
    expect(recorded.body).toEqual({ ok: false, message: 'Authentication required.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('authenticates anonymous orchestrator mutations before returning schema feedback', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({ method: 'POST', headers: {}, body: { action: 'heartbeat', agentId: 'x' } }, response)

    expect(recorded.statusCode).toBe(401)
    expect(recorded.body).toEqual({ ok: false, message: 'Authentication required.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves authenticated worker reads without requiring an operator session', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.ORCHESTRATOR_WORKER_TOKEN = 'test-worker-token-value'
    const fetchMock = vi.fn()
    for (let index = 0; index < 9; index += 1) {
      fetchMock.mockResolvedValueOnce(new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({ method: 'GET', headers: { 'x-worker-token': 'test-worker-token-value' } }, response)

    expect(recorded.statusCode).toBe(200)
    expect(recorded.body).toMatchObject({ ok: true, workerTokenConfigured: true })
    expect(fetchMock).toHaveBeenCalledTimes(9)
  })

  it('fails operational reads closed for authenticated users outside the operator allowlist', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'viewer-1', email: 'viewer@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({ method: 'GET', headers: { authorization: 'Bearer valid-session' } }, response)

    expect(recorded.statusCode).toBe(403)
    expect(recorded.body).toEqual({ ok: false, message: 'Operator access is not configured for this account.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('allows an allowlisted operator to read orchestrator state', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.LOOP_OPERATOR_EMAILS = 'operator@example.com'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'operator-1', email: 'operator@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    for (let index = 0; index < 5; index += 1) {
      fetchMock.mockResolvedValueOnce(new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    }
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'GET',
      headers: { authorization: 'Bearer valid-session' },
      query: { runId: 'run-1' },
    }, response)

    expect(recorded.statusCode).toBe(200)
    expect(recorded.body).toMatchObject({ ok: true, run: null })
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })

  it('does not let a user bearer token enter worker-only mutation paths', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.ORCHESTRATOR_WORKER_TOKEN = 'worker-secret'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer user-session' },
      body: { action: 'lease', workerId: 'not-a-worker' },
    }, response)

    expect(recorded.statusCode).toBe(401)
    expect(recorded.body).toEqual({ ok: false, message: 'Worker token required.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects malformed worker payloads before any database mutation', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.ORCHESTRATOR_WORKER_TOKEN = 'test-worker-token-value'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { 'x-worker-token': 'test-worker-token-value' },
      body: { action: 'workerEvent', runId: 'run-1', eventType: 'output', message: 'x'.repeat(4001) },
    }, response)

    expect(recorded.statusCode).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not let a worker token resolve a human approval gate', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.ORCHESTRATOR_WORKER_TOKEN = 'worker-secret'
    process.env.LOOP_OPERATOR_EMAILS = 'operator@example.com'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid token' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer worker-secret' },
      body: { action: 'approve', approvalId: 'approval-1' },
    }, response)

    expect(recorded.statusCode).toBe(401)
    expect(recorded.body).toEqual({ ok: false, message: 'Sign in required to perform this action.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/v1/user')
  })

  it('fails orchestrator operator mutations closed when the operator allowlist is empty', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'operator-1', email: 'operator@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/orchestrator.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-session' },
      body: { action: 'createRun', name: 'Denied run' },
    }, response)

    expect(recorded.statusCode).toBe(403)
    expect(recorded.body).toEqual({ ok: false, message: 'Operator access is not configured for this account.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not reveal proposal service configuration to anonymous callers', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/proposal-approve.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: {},
      body: { proposalId: 'proposal-1', action: 'approved' },
    }, response)

    expect(recorded.statusCode).toBe(401)
    expect(recorded.body).toEqual({ ok: false, message: 'Invalid or expired session.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails proposal approval closed when the approver allowlist is empty', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'approver-1', email: 'approver@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/proposal-approve.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-session' },
      body: { proposalId: 'proposal-1', action: 'approved', reason: 'Reviewed.' },
    }, response)

    expect(recorded.statusCode).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an invalid proposal action without invoking the decision RPC', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.LOOP_APPROVER_EMAILS = 'approver@example.com'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'approver-1', email: 'approver@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/proposal-approve.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-session' },
      body: { proposalId: 'proposal-1', action: 'unexpected' },
    }, response)

    expect(recorded.statusCode).toBe(400)
    expect(recorded.body).toEqual({ ok: false, message: 'proposalId and action are required.' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/auth/v1/user')
  })

  it('writes the allowlisted proposal actor to eval and activation metadata', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.LOOP_APPROVER_EMAILS = ' APPROVER@example.com '
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'approver-1', email: 'approver@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('"applied"', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/proposal-approve.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-session' },
      body: { proposalId: 'proposal-1', action: 'approved', reason: 'Evidence reviewed.' },
    }, response)

    expect(recorded.statusCode).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rest/v1/rpc/apply_loop_proposal_decision')
    const decisionBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body))
    expect(decisionBody).toMatchObject({
      p_proposal_id: 'proposal-1',
      p_decision: 'approved',
      p_reason: 'Evidence reviewed.',
      p_actor_user_id: 'approver-1',
      p_actor_email: 'approver@example.com',
    })
  })

  it('returns conflict when a proposal has already left pending approval', async () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.LOOP_APPROVER_EMAILS = 'approver@example.com'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'approver-1', email: 'approver@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response('"not_pending"', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    const { default: handler } = await import('../api/proposal-approve.ts')
    const { response, recorded } = responseRecorder()

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer valid-session' },
      body: { proposalId: 'proposal-1', action: 'rejected', reason: 'Too late.' },
    }, response)

    expect(recorded.statusCode).toBe(409)
    expect(recorded.body).toEqual({ ok: false, message: 'Proposal is no longer pending approval.' })
  })
})

describe('Vercel API module resolution', () => {
  it('uses emitted .js paths for every shared runtime import', () => {
    const root = resolve(import.meta.dirname, '..')
    for (const file of ['loop-task.ts', 'orchestrator.ts', 'proposal-approve.ts']) {
      const source = readFileSync(resolve(root, 'api', file), 'utf8')
      expect(source).not.toMatch(/from ['"]\.\/[^'"]+\.ts['"]/)
      for (const imported of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g)) {
        expect(imported[1]).toMatch(/\.js$/)
      }
    }
  })
})

describe('browser Supabase session propagation', () => {
  it('uses the current session access token and never substitutes the anon key', async () => {
    const { supabase, supabaseAuthHeaders } = await import('./lib/supabase')
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { access_token: 'operator-session-token' } },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>)

    await expect(supabaseAuthHeaders()).resolves.toEqual({
      authorization: 'Bearer operator-session-token',
    })
  })
})

describe('P0 containment migration', () => {
  it('drops every legacy public-read policy and revokes anonymous table privileges', () => {
    const root = resolve(import.meta.dirname, '..')
    const legacySql = [
      'supabase/migrations/20260707000000_loop_engineering_schema.sql',
      'supabase/migrations/20260708042000_loop_task_queue.sql',
      'supabase/migrations/20260708045000_multi_agent_orchestrator.sql',
    ].map((path) => readFileSync(resolve(root, path), 'utf8')).join('\n')
    const broadAuthSql = readFileSync(
      resolve(root, 'supabase/migrations/20260722000000_p0_drop_all_public_policies.sql'),
      'utf8',
    )
    const containment = readFileSync(
      resolve(root, 'supabase/migrations/20260722010000_p0_auth_containment.sql'),
      'utf8',
    )
    const policyNames = [...legacySql.matchAll(/create policy "([^"]+_public_read)"/g)].map((match) => match[1])
    const broadAuthPolicyNames = [...broadAuthSql.matchAll(/create policy "([^"]+_auth_read)"/g)].map((match) => match[1])

    expect(policyNames.length).toBeGreaterThan(0)
    for (const policyName of policyNames) {
      expect(containment).toContain(`drop policy if exists "${policyName}"`)
    }
    expect(broadAuthPolicyNames.length).toBeGreaterThan(0)
    for (const policyName of broadAuthPolicyNames) {
      expect(containment).toContain(`drop policy if exists "${policyName}"`)
    }
    expect(containment).toMatch(/revoke all privileges[\s\S]+from anon;/)
    expect(containment).toContain('drop policy if exists "loop_proposals_auth_update"')
    expect(containment).toContain('create or replace function public.loop_dashboard_authorized()')
    expect(containment).toContain('create or replace function public.apply_loop_proposal_decision(')
    expect(containment).toContain("and status = 'pending_approval'")
    expect(containment).toContain("if p_decision = 'approved' then")
    expect(containment).toContain("return 'not_pending'")
    expect(containment).not.toContain('p_status text')
    expect(containment).not.toContain('p_action text')
    expect(containment).toContain("service@maximo-seo.com")
    expect(containment).not.toMatch(/to authenticated using \(true\)/)
  })
})
