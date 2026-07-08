import { useEffect, useMemo, useState } from 'react'
import type { AgentAssignment, AgentEvent, OrchestratorRun, RunApproval } from '../types.ts'
import { createOrchestratorRun, fetchOrchestratorState, requestApproval, type OrchestratorState } from '../data/orchestrator.ts'

const modes: Array<{ id: OrchestratorRun['mode']; title: string; detail: string }> = [
  { id: 'parallel_specialists', title: 'Parallel specialists', detail: 'Planner, frontend, backend, QA and security run as separate lanes.' },
  { id: 'swarm_verify', title: 'Swarm + verifier', detail: 'Adds SEO/research lane and strict verification before done.' },
  { id: 'pipeline', title: 'Sequential pipeline', detail: 'Plan → backend → frontend → QA → security.' },
  { id: 'debate', title: 'Debate / critique', detail: 'Multiple planning agents critique and synthesize.' },
  { id: 'lead_agent', title: 'Single lead agent', detail: 'Minimal orchestration for smaller jobs.' },
]

const statusOrder: AgentAssignment['status'][] = ['queued', 'leased', 'running', 'blocked', 'needs_review', 'done', 'failed', 'cancelled']

function shortTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}

function asText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function countByStatus(assignments: AgentAssignment[]) {
  return statusOrder.reduce<Record<string, number>>((acc, status) => {
    acc[status] = assignments.filter((item) => item.status === status).length
    return acc
  }, {})
}

function latestEvent(events: AgentEvent[], assignmentId: string) {
  return events.find((event) => event.assignment_id === assignmentId)
}

export function ProjectOrchestrator() {
  const [state, setState] = useState<OrchestratorState | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [name, setName] = useState('Improve Loop Engineering Dashboard')
  const [objective, setObjective] = useState('Coordinate multiple bots and model profiles on the same dashboard project with verifier and approval gates.')
  const [contextUrl, setContextUrl] = useState('https://loop-engineering-dashboard.vercel.app')
  const [mode, setMode] = useState<OrchestratorRun['mode']>('parallel_specialists')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchOrchestratorState()
      setState(next)
      if (!selectedRunId && next.runs[0]) setSelectedRunId(next.runs[0].run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 20_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedRun = useMemo(() => state?.runs.find((run) => run.run_id === selectedRunId) || state?.runs[0] || null, [state, selectedRunId])
  const runAssignments = useMemo(() => state?.assignments.filter((item) => item.run_id === selectedRun?.run_id) || [], [state, selectedRun])
  const runEvents = useMemo(() => state?.events.filter((item) => item.run_id === selectedRun?.run_id) || [], [state, selectedRun])
  const runApprovals = useMemo(() => state?.approvals.filter((item) => item.run_id === selectedRun?.run_id) || [], [state, selectedRun])
  const stats = useMemo(() => countByStatus(runAssignments), [runAssignments])

  async function submitRun() {
    setCreating(true)
    setError(null)
    try {
      const payload = await createOrchestratorRun({
        name,
        objective,
        contextUrl,
        mode,
        constraints: ['No secrets in UI', 'Use resource locks for shared files', 'Human approval for deploy/migrations', 'Production QA required'],
        successCriteria: ['Assignments persisted', 'At least one worker lease can complete', 'Verifier lane reports evidence', 'Dashboard updates after refresh'],
        budget: { maxParallelAgents: mode === 'lead_agent' ? 2 : 5, maxRuntimeMinutes: 45, maxCostUsd: 5 },
      })
      const next = await fetchOrchestratorState()
      setState(next)
      setSelectedRunId(payload.run.run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  async function addDeployApproval() {
    if (!selectedRun) return
    setError(null)
    try {
      await requestApproval(selectedRun.run_id, 'production_deploy', 'Production deploy must be approved after tests, secret scan and browser QA.', 'high')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section id="orchestrator" className="dashboard-section orchestrator-cockpit" aria-label="Multi-agent project orchestrator">
      <div className="section-header">
        <div>
          <p className="eyebrow">Multi-agent control plane</p>
          <h2>Project Orchestrator</h2>
          <p>Run several bots and model profiles on the same project with leases, verifier lanes, artifacts and approval gates.</p>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          <span className={state?.workerTokenConfigured ? 'status-pill ready' : 'status-pill warn'}>{state?.workerTokenConfigured ? 'Worker token ready' : 'Worker token missing'}</span>
        </div>
      </div>

      <div className="orchestrator-grid">
        <div className="glass-card orchestrator-create-card">
          <div className="card-title-row">
            <div>
              <span className="mini-label">Create project run</span>
              <h3>Objective and orchestration mode</h3>
            </div>
            <span className="status-pill ready">Control plane</span>
          </div>

          <label className="field-label" htmlFor="orchestrator-name">Project name</label>
          <input id="orchestrator-name" className="orchestrator-input" value={name} onChange={(event) => setName(event.target.value)} />

          <label className="field-label" htmlFor="orchestrator-objective">Objective</label>
          <textarea id="orchestrator-objective" className="orchestrator-textarea" value={objective} onChange={(event) => setObjective(event.target.value)} />

          <label className="field-label" htmlFor="orchestrator-context">Context URL</label>
          <input id="orchestrator-context" className="orchestrator-input" value={contextUrl} onChange={(event) => setContextUrl(event.target.value)} />

          <div className="mode-picker" role="radiogroup" aria-label="Orchestration mode">
            {modes.map((item) => (
              <button key={item.id} type="button" className={item.id === mode ? 'mode-card selected' : 'mode-card'} onClick={() => setMode(item.id)}>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </button>
            ))}
          </div>

          <button className="primary-action wide" type="button" onClick={() => void submitRun()} disabled={creating || !objective.trim()}>
            {creating ? 'Creating run…' : 'Create orchestration run'}
          </button>
          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="glass-card agent-matrix-card">
          <div className="card-title-row">
            <div>
              <span className="mini-label">Agent/model matrix</span>
              <h3>Available bots</h3>
            </div>
            <span className="status-pill ready">{state?.agents.length || 0} agents</span>
          </div>
          <div className="agent-matrix">
            {(state?.agents || []).map((agent) => {
              const model = state?.models.find((item) => item.model_profile_id === agent.default_model_profile_id)
              return (
                <div className="agent-row" key={agent.agent_id}>
                  <div>
                    <strong>{agent.name}</strong>
                    <span>{agent.role}</span>
                  </div>
                  <div>
                    <code>{model?.label || agent.default_model_profile_id || 'none'}</code>
                    <span>{model?.purpose || agent.type}</span>
                  </div>
                  <span className={`status-pill ${agent.status === 'online' ? 'ready' : 'warn'}`}>{agent.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="orchestrator-run-grid">
        <div className="glass-card run-board-card">
          <div className="card-title-row">
            <div>
              <span className="mini-label">Live run board</span>
              <h3>{selectedRun ? `${selectedRun.mode.replaceAll('_', ' ')} · ${selectedRun.status}` : 'No run selected'}</h3>
            </div>
            <select className="orchestrator-select" value={selectedRun?.run_id || ''} onChange={(event) => setSelectedRunId(event.target.value)}>
              {(state?.runs || []).map((run) => <option key={run.run_id} value={run.run_id}>{run.run_id} · {run.status}</option>)}
            </select>
          </div>

          <div className="run-stat-strip">
            <span>Queued <strong>{stats.queued || 0}</strong></span>
            <span>Running <strong>{(stats.leased || 0) + (stats.running || 0)}</strong></span>
            <span>Review <strong>{stats.needs_review || 0}</strong></span>
            <span>Done <strong>{stats.done || 0}</strong></span>
            <span>Failed <strong>{stats.failed || 0}</strong></span>
          </div>

          <div className="agent-lanes">
            {runAssignments.length ? runAssignments.map((assignment) => {
              const agent = state?.agents.find((item) => item.agent_id === assignment.agent_id)
              const modelProfile = state?.models.find((item) => item.model_profile_id === assignment.model_profile_id)
              const event = latestEvent(runEvents, assignment.assignment_id)
              return (
                <article className={`lane-card ${assignment.status}`} key={assignment.assignment_id}>
                  <div className="lane-head">
                    <div>
                      <strong>{agent?.name || assignment.agent_id}</strong>
                      <span>{asText(assignment.input.title) || agent?.role || 'Assignment'}</span>
                    </div>
                    <span className={`status-pill ${['done'].includes(assignment.status) ? 'ready' : ['failed','blocked'].includes(assignment.status) ? 'danger' : 'warn'}`}>{assignment.status}</span>
                  </div>
                  <div className="lane-meta">
                    <span>Model <code>{modelProfile?.label || assignment.model_profile_id || 'none'}</code></span>
                    <span>Lease <code>{assignment.lease_owner || '—'}</code></span>
                    <span>Updated <code>{shortTime(assignment.updated_at)}</code></span>
                  </div>
                  <p>{event?.message || assignment.error || 'Waiting for worker lease.'}</p>
                </article>
              )
            }) : <p className="empty-state">Create an orchestration run to see agent lanes.</p>}
          </div>
        </div>

        <div className="glass-card event-card">
          <div className="card-title-row">
            <div>
              <span className="mini-label">Events, approvals, workers</span>
              <h3>Audit timeline</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => void addDeployApproval()} disabled={!selectedRun}>Request deploy approval</button>
          </div>

          <div className="approval-strip">
            {runApprovals.length ? runApprovals.map((approval: RunApproval) => (
              <div className="approval-card" key={approval.approval_id}>
                <span className={`status-pill ${approval.status === 'approved' ? 'ready' : approval.status === 'rejected' ? 'danger' : 'warn'}`}>{approval.status}</span>
                <strong>{approval.action_type}</strong>
                <p>{approval.reason || 'Approval requested.'}</p>
              </div>
            )) : <p className="empty-state">No approvals pending for this run.</p>}
          </div>

          <div className="event-list">
            {runEvents.slice(0, 12).map((event) => (
              <div className="event-row" key={event.id}>
                <span>{shortTime(event.created_at)}</span>
                <strong>{event.event_type}</strong>
                <p>{event.message}</p>
              </div>
            ))}
          </div>

          <div className="worker-strip">
            {(state?.heartbeats || []).map((worker) => (
              <span className="worker-pill" key={worker.worker_id}>{worker.worker_id} · {worker.status} · {shortTime(worker.last_heartbeat)}</span>
            ))}
            {!(state?.heartbeats || []).length ? <span className="worker-pill muted">No worker heartbeat yet</span> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
