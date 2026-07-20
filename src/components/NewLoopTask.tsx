import { useEffect, useMemo, useRef, useState } from 'react'
import type { LoopTaskDestination, LoopTaskHandoff, LoopTaskKind, LoopTaskPriority, LoopTaskProcessStep, LoopTaskStatus } from '../types.ts'
import { fetchTaskQueue } from '../data/taskQueue.ts'

type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'error'
type SubmitStatus = 'delivered' | 'blocked_config' | 'failed' | 'queued'

interface DeliveryReadiness {
  api: string
  publicDeliveryEnabled: boolean
  telegramConfigured: boolean
  webhookConfigured: boolean
  queueConfigured?: boolean
  defaultRoute: string
}

interface ProcessStep {
  key: string
  label: string
  detail: string
  state: StepState
}

interface SubmitResponse {
  ok: boolean
  taskId: string
  status: SubmitStatus
  destination: string
  message: string
  deliveryReadiness?: DeliveryReadiness
  process: Array<{ label: string; state: StepState; detail: string }>
}

interface StatusResponse {
  ok: boolean
  deliveryReadiness: DeliveryReadiness
  tasks?: LoopTaskHandoff[]
}

const initialSteps: ProcessStep[] = [
  { key: 'capture', label: 'Capture request', detail: 'Write the task or project brief.', state: 'pending' },
  { key: 'validate', label: 'Validate scope', detail: 'Check priority, destination, and required text.', state: 'pending' },
  { key: 'route', label: 'Route to bot / worker', detail: 'Send through the backend intake endpoint.', state: 'pending' },
  { key: 'run', label: 'Run / wait for agent', detail: 'The external bot or worker owns execution.', state: 'pending' },
  { key: 'verify', label: 'Verify & report back', detail: 'Confirm output before marking work complete.', state: 'pending' },
]

const templates: Array<{ label: string; kind: LoopTaskKind; priority: LoopTaskPriority; text: string; expected: string }> = [
  {
    label: 'New project',
    kind: 'project',
    priority: 'high',
    text: 'Start a new Loop Engineering project to improve agent run quality, define success criteria, run checks, and report progress back in the dashboard.',
    expected: 'A clear plan, execution status, verification output, and final summary.',
  },
  {
    label: 'Debug failed run',
    kind: 'debug',
    priority: 'high',
    text: 'Debug the latest low-scoring or failed agent run, identify the root cause, and create a safe recovery proposal with verification steps.',
    expected: 'Root cause, affected run/task id, fix proposal, and validation checklist.',
  },
  {
    label: 'Review proposal',
    kind: 'proposal',
    priority: 'normal',
    text: 'Review the latest high-risk improvement proposal, summarize the risk, required evals, and whether it is safe to approve through CLI handoff.',
    expected: 'Risk summary, eval status, approval recommendation, and CLI handoff command if safe.',
  },
  {
    label: 'Improve dashboard',
    kind: 'dashboard',
    priority: 'normal',
    text: 'Improve the Loop Engineering Dashboard UI/UX while preserving live-data proof, production links, and end-to-end verification.',
    expected: 'Production deploy, visual QA, live-data proof, and zero console errors.',
  },
  {
    label: 'Run QA',
    kind: 'agent-run',
    priority: 'normal',
    text: 'Run production QA for the Loop Engineering Dashboard, verify live Supabase data, task intake, browser console, and Dashboard of Dashboards links.',
    expected: 'QA report with exact checks, pass/fail status, and production URL.',
  },
]

const fallbackReadiness: DeliveryReadiness = {
  api: 'checking',
  publicDeliveryEnabled: false,
  telegramConfigured: false,
  webhookConfigured: false,
  queueConfigured: false,
  defaultRoute: 'checking',
}

const activeStatuses: LoopTaskStatus[] = ['queued', 'delivered', 'accepted', 'running', 'needs_review']

function applyResponseSteps(response: SubmitResponse): ProcessStep[] {
  return response.process.map((step, index) => ({
    key: `${index}-${step.label}`,
    label: step.label,
    detail: step.detail,
    state: step.state,
  }))
}

function readinessLabel(readiness: DeliveryReadiness) {
  if (readiness.defaultRoute === 'checking') return 'Checking delivery'
  if (!readiness.queueConfigured) return 'Queue missing'
  if (!readiness.publicDeliveryEnabled) return 'Delivery disabled'
  if (readiness.webhookConfigured) return 'Webhook ready'
  if (readiness.telegramConfigured) return 'Telegram ready'
  return 'No route configured'
}

function statusCopy(status: SubmitStatus | LoopTaskStatus) {
  const map: Record<string, string> = {
    queued: 'Queued',
    delivered: 'Delivered',
    accepted: 'Accepted',
    running: 'Running',
    needs_review: 'Needs review',
    done: 'Done',
    blocked_config: 'Configuration required',
    failed: 'Failed',
    archived: 'Archived',
  }
  return map[status] || status
}

function shortTask(task: string) {
  return task.length > 110 ? `${task.slice(0, 110)}…` : task
}

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function toProcessSteps(steps: LoopTaskProcessStep[]): ProcessStep[] {
  return steps.map((step, index) => ({ key: `${index}-${step.label}`, ...step }))
}

function TaskDetailDrawer({ task, onClose }: { task: LoopTaskHandoff; onClose: () => void }) {
  const drawerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    drawerRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'Tab') {
        const focusables = drawerRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prevFocus?.focus?.()
    }
  }, [onClose])
  return (
    <div className="task-detail-backdrop" role="presentation" onClick={onClose}>
      <aside ref={drawerRef} tabIndex={-1} className="task-detail-drawer" role="dialog" aria-modal="true" aria-label="Task details" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <p className="section-kicker">Task detail</p>
            <h3>{statusCopy(task.status)} · {task.kind}</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>Close</button>
        </div>
        <p className="drawer-task-text">{task.task}</p>
        <div className="drawer-meta-grid">
          <div><small>Priority</small><strong>{task.priority}</strong></div>
          <div><small>Destination</small><strong>{task.resolved_destination}</strong></div>
          <div><small>Created</small><strong>{timeAgo(task.created_at)}</strong></div>
          <div><small>Updated</small><strong>{timeAgo(task.updated_at)}</strong></div>
        </div>
        <div className="drawer-actions">
          <button type="button" onClick={() => void navigator.clipboard?.writeText(task.task_id)}>Copy task id</button>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(task.task)}>Copy prompt</button>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(`Verify task ${task.task_id} and update the Loop Engineering queue.`)}>Copy verify command</button>
        </div>
        <div className="drawer-timeline">
          <p className="section-kicker">Process timeline</p>
          <ol>
            {toProcessSteps(task.process || []).map((step) => (
              <li key={step.key} className={step.state}>
                <span aria-hidden="true" />
                <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="drawer-result">
          <p className="section-kicker">Latest message</p>
          <p>{task.delivery_message || task.result_summary || task.error || 'No result yet.'}</p>
          <code>{task.task_id}</code>
        </div>
      </aside>
    </div>
  )
}

export function NewLoopTask() {
  const [task, setTask] = useState('')
  const [expectedResult, setExpectedResult] = useState('')
  const [contextUrl, setContextUrl] = useState('')
  const [kind, setKind] = useState<LoopTaskKind>('agent-run')
  const [priority, setPriority] = useState<LoopTaskPriority>('normal')
  const [destination, setDestination] = useState<LoopTaskDestination>('auto')
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<DeliveryReadiness>(fallbackReadiness)
  const [tasks, setTasks] = useState<LoopTaskHandoff[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'done' | 'failed'>('all')
  const [selectedTask, setSelectedTask] = useState<LoopTaskHandoff | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)

  const trimmed = task.trim()
  const canSubmit = trimmed.length >= 10 && trimmed.length <= 4000 && !submitting
  const helper = useMemo(() => {
    if (trimmed.length === 0) return 'Describe the outcome. Tasks are saved to Supabase and routed through Telegram/Hermes when delivery is ready.'
    if (trimmed.length < 10) return 'Add a little more detail so the agent can understand the task.'
    if (trimmed.length > 4000) return 'Task is too long. Keep it under 4000 characters.'
    return `${trimmed.length} characters ready to send.`
  }, [trimmed])

  const queueStats = useMemo(() => {
    const active = tasks.filter((item) => activeStatuses.includes(item.status)).length
    const review = tasks.filter((item) => item.status === 'needs_review').length
    const failed = tasks.filter((item) => item.status === 'failed' || item.status === 'blocked_config').length
    const done = tasks.filter((item) => item.status === 'done').length
    return { active, review, failed, done, total: tasks.length }
  }, [tasks])

  const filteredTasks = useMemo(() => tasks.filter((item) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'active') return activeStatuses.includes(item.status)
    if (statusFilter === 'done') return item.status === 'done'
    return item.status === 'failed' || item.status === 'blocked_config'
  }), [statusFilter, tasks])

  const loadQueue = async () => {
    try {
      setQueueError(null)
      const json = await fetchTaskQueue()
      setTasks(json.tasks || [])
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      try {
        const response = await fetch('/api/loop-task?includeTasks=true')
        const json = (await response.json()) as StatusResponse
        if (!cancelled && json.deliveryReadiness) setReadiness(json.deliveryReadiness)
        if (!cancelled && json.tasks) setTasks(json.tasks)
      } catch {
        if (!cancelled) setReadiness({ ...fallbackReadiness, api: 'unreachable', defaultRoute: 'blocked_config' })
      }
    }
    void loadStatus()
    const interval = setInterval(() => void loadQueue(), 30_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  const selectTemplate = (template: typeof templates[number]) => {
    setTask(template.text)
    setExpectedResult(template.expected)
    setKind(template.kind)
    setPriority(template.priority)
    setResult(null)
    setError(null)
    setSteps([
      { ...initialSteps[0], state: 'done', detail: `${template.label} template loaded.` },
      { ...initialSteps[1], state: 'pending' },
      { ...initialSteps[2], state: 'pending' },
      { ...initialSteps[3], state: 'pending' },
      { ...initialSteps[4], state: 'pending' },
    ])
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    setSteps([
      { ...initialSteps[0], state: 'done', detail: 'Task text captured in the browser.' },
      { ...initialSteps[1], state: 'active', detail: 'Validating destination and payload.' },
      { ...initialSteps[2], state: 'pending' },
      { ...initialSteps[3], state: 'pending' },
      { ...initialSteps[4], state: 'pending' },
    ])

    try {
      const response = await fetch('/api/loop-task', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: trimmed, kind, priority, destination, expectedResult: expectedResult.trim(), contextUrl: contextUrl.trim() }),
      })
      const json = (await response.json()) as SubmitResponse
      setResult(json)
      setSteps(applyResponseSteps(json))
      if (json.deliveryReadiness) setReadiness(json.deliveryReadiness)
      await loadQueue()
      if (!response.ok || !json.ok) setError(json.message || 'The intake endpoint could not deliver the task.')
      if (json.ok && json.status === 'delivered') {
        setTask('')
        setExpectedResult('')
        setContextUrl('')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setSteps([
        { ...initialSteps[0], state: 'done', detail: 'Task text captured in the browser.' },
        { ...initialSteps[1], state: 'done', detail: 'Payload prepared.' },
        { ...initialSteps[2], state: 'error', detail: message },
        { ...initialSteps[3], state: 'blocked', detail: 'No delivery confirmation received.' },
        { ...initialSteps[4], state: 'blocked', detail: 'Cannot verify a task that was not delivered.' },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="task-intake" className="task-workbench" aria-labelledby="task-intake-title">
      <div className="task-workbench-header">
        <div>
          <span className="data-proof-pill good">Task Command Workbench</span>
          <h2 id="task-intake-title">Send a task or project into Loop Engineering</h2>
          <p>
            Put the brief here, save it to the Supabase queue, route it through Telegram/Hermes, and keep a persistent task record after refresh.
          </p>
        </div>
        <div className={`delivery-readiness ${readiness.publicDeliveryEnabled && readiness.queueConfigured ? 'ready' : 'blocked'}`} aria-label="Delivery readiness">
          <small>Delivery readiness</small>
          <strong>{readinessLabel(readiness)}</strong>
          <span>API {readiness.api} · Queue {readiness.queueConfigured ? 'ready' : 'missing'}</span>
        </div>
      </div>

      <div className="today-strip" aria-label="Today in Loop Engineering">
        <div><small>Queue</small><strong>{queueStats.total}</strong><span>persistent tasks</span></div>
        <div><small>Active</small><strong>{queueStats.active}</strong><span>queued/running</span></div>
        <div><small>Needs review</small><strong>{queueStats.review}</strong><span>operator action</span></div>
        <div><small>Blocked/failed</small><strong>{queueStats.failed}</strong><span>needs attention</span></div>
      </div>

      <div className="task-workbench-grid">
        <div className="task-form-panel primary-task-panel">
          <label htmlFor="loop-task-text">Task / project brief</label>
          <textarea
            id="loop-task-text"
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="Example: Start a new Loop Engineering project to review failed agent runs, identify root cause, create a safe proposal, and report progress back here."
            rows={6}
          />
          <p className="task-helper">{helper}</p>

          <div className="template-row" aria-label="Task templates">
            {templates.map((template) => (
              <button key={template.label} type="button" onClick={() => selectTemplate(template)}>{template.label}</button>
            ))}
          </div>

          <div className="task-field-grid extended">
            <label>
              Type
              <select value={kind} onChange={(event) => setKind(event.target.value as LoopTaskKind)}>
                <option value="agent-run">Agent run</option>
                <option value="project">New project</option>
                <option value="debug">Debug / investigate</option>
                <option value="dashboard">Dashboard work</option>
                <option value="proposal">Review proposal</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as LoopTaskPriority)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>
              Destination
              <select value={destination} onChange={(event) => setDestination(event.target.value as LoopTaskDestination)}>
                <option value="auto">Auto route</option>
                <option value="telegram">Telegram bot</option>
                <option value="worker-webhook">Worker webhook</option>
              </select>
            </label>
          </div>

          <div className="task-extra-grid">
            <label>
              Expected result / Definition of Done
              <input value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} placeholder="What should be true when this is complete?" />
            </label>
            <label>
              Context link
              <input value={contextUrl} onChange={(event) => setContextUrl(event.target.value)} placeholder="Optional URL, issue, dashboard, or screenshot link" />
            </label>
          </div>

          <div className="task-draft-preview" aria-label="Task draft preview">
            <strong>This will send</strong>
            <span>{kind} · {priority} · {destination === 'auto' ? readiness.defaultRoute : destination}</span>
            <small>Route: Dashboard → Vercel API → Supabase queue → Telegram/Hermes</small>
          </div>

          <div className="task-actions-row">
            <button type="button" className="action-button primary send-to-loop" disabled={!canSubmit} onClick={() => void submit()}>
              {submitting ? 'Sending…' : 'Send to Loop'}
            </button>
            <button type="button" className="action-button" onClick={() => { setTask(''); setExpectedResult(''); setContextUrl(''); setResult(null); setError(null); setSteps(initialSteps) }}>
              Clear
            </button>
            <button type="button" className="action-button" onClick={() => void loadQueue()}>Refresh queue</button>
          </div>

          {error && <p className="task-error" role="alert">{error}</p>}
          {result && (
            <div className={`task-result ${result.status}`}>
              <strong>{statusCopy(result.status)}</strong>
              <span>{result.message}</span>
              <code>{result.taskId}</code>
            </div>
          )}
        </div>

        <aside className="process-panel task-process-card" aria-label="Task delivery process">
          <div>
            <p className="section-kicker">Process tracker</p>
            <h3>What happens after Send</h3>
          </div>
          <ol>
            {steps.map((step) => (
              <li key={step.key} className={step.state}>
                <span aria-hidden="true" />
                <div><strong>{step.label}</strong><small>{step.detail}</small></div>
              </li>
            ))}
          </ol>
          <div className="readiness-grid">
            <div><small>Public delivery</small><strong>{readiness.publicDeliveryEnabled ? 'Enabled' : 'Disabled'}</strong></div>
            <div><small>Persistent queue</small><strong>{readiness.queueConfigured ? 'Configured' : 'Missing'}</strong></div>
            <div><small>Telegram</small><strong>{readiness.telegramConfigured ? 'Configured' : 'Missing'}</strong></div>
            <div><small>Webhook</small><strong>{readiness.webhookConfigured ? 'Configured' : 'Missing'}</strong></div>
          </div>
        </aside>
      </div>

      <div className="recent-handoffs task-queue-panel" aria-label="Persistent task queue">
        <div className="queue-header">
          <div>
            <p className="section-kicker">Persistent task queue</p>
            <h3>Latest Loop handoffs from Supabase</h3>
          </div>
          <div className="queue-filters" aria-label="Task queue filters">
            {(['all', 'active', 'done', 'failed'] as const).map((filter) => (
              <button key={filter} type="button" aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>{filter}</button>
            ))}
          </div>
        </div>
        {queueError && <p className="task-error" role="alert">{queueError}</p>}
        {filteredTasks.length ? (
          <div className="handoff-list persistent">
            {filteredTasks.map((item) => (
              <article key={item.task_id} className={item.status} onClick={() => setSelectedTask(item)} tabIndex={0} role="button" aria-label={`Open task ${item.task_id}`}>
                <div><strong>{statusCopy(item.status)}</strong><span>{timeAgo(item.created_at)} · {item.kind} · {item.priority} · {item.resolved_destination}</span></div>
                <p>{shortTask(item.task)}</p>
                <small>{item.delivery_message || item.error || 'Waiting for status update.'}</small>
                <code>{item.task_id}</code>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-handoffs">No matching tasks yet. Send a task to create a persistent queue row.</p>
        )}
      </div>
      {selectedTask && <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </section>
  )
}
