import { useEffect, useMemo, useState } from 'react'

type TaskKind = 'agent-run' | 'project' | 'debug' | 'dashboard' | 'proposal'
type Priority = 'normal' | 'high' | 'urgent'
type Destination = 'auto' | 'telegram' | 'worker-webhook'
type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'error'
type SubmitStatus = 'delivered' | 'blocked_config' | 'failed'

interface DeliveryReadiness {
  api: string
  publicDeliveryEnabled: boolean
  telegramConfigured: boolean
  webhookConfigured: boolean
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
}

interface Handoff {
  id: string
  task: string
  kind: TaskKind
  priority: Priority
  destination: string
  status: SubmitStatus
  message: string
  createdAt: string
}

const initialSteps: ProcessStep[] = [
  { key: 'capture', label: 'Capture request', detail: 'Write the task or project brief.', state: 'pending' },
  { key: 'validate', label: 'Validate scope', detail: 'Check priority, destination, and required text.', state: 'pending' },
  { key: 'route', label: 'Route to bot / worker', detail: 'Send through the backend intake endpoint.', state: 'pending' },
  { key: 'run', label: 'Run / wait for agent', detail: 'The external bot or worker owns execution.', state: 'pending' },
  { key: 'verify', label: 'Verify & report back', detail: 'Confirm output before marking work complete.', state: 'pending' },
]

const templates: Array<{ label: string; kind: TaskKind; priority: Priority; text: string }> = [
  {
    label: 'New project',
    kind: 'project',
    priority: 'high',
    text: 'Start a new Loop Engineering project to improve agent run quality, define success criteria, run checks, and report progress back in the dashboard.',
  },
  {
    label: 'Debug failed run',
    kind: 'debug',
    priority: 'high',
    text: 'Debug the latest low-scoring or failed agent run, identify the root cause, and create a safe recovery proposal with verification steps.',
  },
  {
    label: 'Review proposal',
    kind: 'proposal',
    priority: 'normal',
    text: 'Review the latest high-risk improvement proposal, summarize the risk, required evals, and whether it is safe to approve through CLI handoff.',
  },
  {
    label: 'Improve dashboard',
    kind: 'dashboard',
    priority: 'normal',
    text: 'Improve the Loop Engineering Dashboard UI/UX while preserving live-data proof, production links, and end-to-end verification.',
  },
  {
    label: 'Run QA',
    kind: 'agent-run',
    priority: 'normal',
    text: 'Run production QA for the Loop Engineering Dashboard, verify live Supabase data, task intake, browser console, and Dashboard of Dashboards links.',
  },
]

const fallbackReadiness: DeliveryReadiness = {
  api: 'checking',
  publicDeliveryEnabled: false,
  telegramConfigured: false,
  webhookConfigured: false,
  defaultRoute: 'checking',
}

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
  if (!readiness.publicDeliveryEnabled) return 'Delivery disabled'
  if (readiness.webhookConfigured) return 'Webhook ready'
  if (readiness.telegramConfigured) return 'Telegram ready'
  return 'No route configured'
}

function statusCopy(status: SubmitStatus) {
  if (status === 'delivered') return 'Delivered'
  if (status === 'blocked_config') return 'Configuration required'
  return 'Delivery failed'
}

function shortTask(task: string) {
  return task.length > 96 ? `${task.slice(0, 96)}…` : task
}

export function NewLoopTask() {
  const [task, setTask] = useState('')
  const [kind, setKind] = useState<TaskKind>('agent-run')
  const [priority, setPriority] = useState<Priority>('normal')
  const [destination, setDestination] = useState<Destination>('auto')
  const [steps, setSteps] = useState<ProcessStep[]>(initialSteps)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<DeliveryReadiness>(fallbackReadiness)
  const [recent, setRecent] = useState<Handoff[]>([])

  const trimmed = task.trim()
  const canSubmit = trimmed.length >= 10 && trimmed.length <= 4000 && !submitting
  const helper = useMemo(() => {
    if (trimmed.length === 0) return 'Describe the outcome. The dashboard will route it only when a delivery channel is configured.'
    if (trimmed.length < 10) return 'Add a little more detail so the agent can understand the task.'
    if (trimmed.length > 4000) return 'Task is too long. Keep it under 4000 characters.'
    return `${trimmed.length} characters ready to send.`
  }, [trimmed])

  useEffect(() => {
    let cancelled = false
    async function loadStatus() {
      try {
        const response = await fetch('/api/loop-task')
        const json = (await response.json()) as StatusResponse
        if (!cancelled && json.deliveryReadiness) setReadiness(json.deliveryReadiness)
      } catch {
        if (!cancelled) setReadiness({ ...fallbackReadiness, api: 'unreachable', defaultRoute: 'blocked_config' })
      }
    }
    void loadStatus()
    return () => { cancelled = true }
  }, [])

  const selectTemplate = (template: typeof templates[number]) => {
    setTask(template.text)
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
        body: JSON.stringify({ task: trimmed, kind, priority, destination }),
      })
      const json = (await response.json()) as SubmitResponse
      setResult(json)
      setSteps(applyResponseSteps(json))
      if (json.deliveryReadiness) setReadiness(json.deliveryReadiness)
      setRecent((items) => [{
        id: json.taskId,
        task: trimmed,
        kind,
        priority,
        destination: json.destination,
        status: json.status,
        message: json.message,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }, ...items].slice(0, 4))
      if (!response.ok || !json.ok) {
        setError(json.message || 'The intake endpoint could not deliver the task.')
      }
      if (json.ok && json.status === 'delivered') {
        setTask('')
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
            Put the brief here, choose where it should go, send it to the backend intake, and watch every routing step honestly.
          </p>
        </div>
        <div className={`delivery-readiness ${readiness.publicDeliveryEnabled ? 'ready' : 'blocked'}`} aria-label="Delivery readiness">
          <small>Delivery readiness</small>
          <strong>{readinessLabel(readiness)}</strong>
          <span>API {readiness.api}</span>
        </div>
      </div>

      <div className="task-workbench-grid">
        <div className="task-form-panel primary-task-panel">
          <label htmlFor="loop-task-text">Task / project brief</label>
          <textarea
            id="loop-task-text"
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="Example: Start a new Loop Engineering project to review failed agent runs, identify root cause, create a safe proposal, and report progress back here."
            rows={7}
          />
          <p className="task-helper">{helper}</p>

          <div className="template-row" aria-label="Task templates">
            {templates.map((template) => (
              <button key={template.label} type="button" onClick={() => selectTemplate(template)}>
                {template.label}
              </button>
            ))}
          </div>

          <div className="task-field-grid">
            <label>
              Type
              <select value={kind} onChange={(event) => setKind(event.target.value as TaskKind)}>
                <option value="agent-run">Agent run</option>
                <option value="project">New project</option>
                <option value="debug">Debug / investigate</option>
                <option value="dashboard">Dashboard work</option>
                <option value="proposal">Review proposal</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>
              Destination
              <select value={destination} onChange={(event) => setDestination(event.target.value as Destination)}>
                <option value="auto">Auto route</option>
                <option value="telegram">Telegram bot</option>
                <option value="worker-webhook">Worker webhook</option>
              </select>
            </label>
          </div>

          <div className="task-actions-row">
            <button type="button" className="action-button primary send-to-loop" disabled={!canSubmit} onClick={() => void submit()}>
              {submitting ? 'Sending…' : 'Send to Loop'}
            </button>
            <button type="button" className="action-button" onClick={() => { setTask(''); setResult(null); setError(null); setSteps(initialSteps) }}>
              Clear
            </button>
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
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
              </li>
            ))}
          </ol>
          <div className="readiness-grid">
            <div><small>Public delivery</small><strong>{readiness.publicDeliveryEnabled ? 'Enabled' : 'Disabled'}</strong></div>
            <div><small>Telegram</small><strong>{readiness.telegramConfigured ? 'Configured' : 'Missing'}</strong></div>
            <div><small>Webhook</small><strong>{readiness.webhookConfigured ? 'Configured' : 'Missing'}</strong></div>
            <div><small>Default route</small><strong>{readiness.defaultRoute}</strong></div>
          </div>
        </aside>
      </div>

      <div className="recent-handoffs" aria-label="Recent task handoffs">
        <div>
          <p className="section-kicker">Recent task handoffs</p>
          <h3>Latest sends from this browser session</h3>
        </div>
        {recent.length ? (
          <div className="handoff-list">
            {recent.map((item) => (
              <article key={item.id} className={item.status}>
                <div>
                  <strong>{statusCopy(item.status)}</strong>
                  <span>{item.createdAt} · {item.kind} · {item.priority} · {item.destination}</span>
                </div>
                <p>{shortTask(item.task)}</p>
                <small>{item.message}</small>
                <code>{item.id}</code>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-handoffs">No tasks sent from this browser yet. Send a task to see its routing status here.</p>
        )}
      </div>
    </section>
  )
}
