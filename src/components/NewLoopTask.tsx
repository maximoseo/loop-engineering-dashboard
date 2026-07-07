import { useMemo, useState } from 'react'

type TaskKind = 'agent-run' | 'project' | 'debug' | 'dashboard' | 'proposal'
type Priority = 'normal' | 'high' | 'urgent'
type Destination = 'auto' | 'telegram' | 'worker-webhook'
type StepState = 'pending' | 'active' | 'done' | 'blocked' | 'error'

interface ProcessStep {
  key: string
  label: string
  detail: string
  state: StepState
}

interface SubmitResponse {
  ok: boolean
  taskId: string
  status: 'delivered' | 'blocked_config' | 'failed'
  destination: string
  message: string
  process: Array<{ label: string; state: StepState; detail: string }>
}

const initialSteps: ProcessStep[] = [
  { key: 'capture', label: 'Capture request', detail: 'Write the task or project brief.', state: 'pending' },
  { key: 'validate', label: 'Validate scope', detail: 'Check priority, destination, and required text.', state: 'pending' },
  { key: 'handoff', label: 'Send to bot / worker', detail: 'Route through the backend intake endpoint.', state: 'pending' },
  { key: 'track', label: 'Track process', detail: 'Show whether it was delivered, queued, or blocked.', state: 'pending' },
]

const samplePrompts = [
  'Review the latest high-risk proposal and prepare a safe approval plan.',
  'Start a new Loop Engineering project for improving dashboard QA and regression checks.',
  'Debug why an agent run scored below 70 and create a recovery proposal.',
]

function applyResponseSteps(response: SubmitResponse): ProcessStep[] {
  return response.process.map((step, index) => ({
    key: `${index}-${step.label}`,
    label: step.label,
    detail: step.detail,
    state: step.state,
  }))
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

  const trimmed = task.trim()
  const canSubmit = trimmed.length >= 10 && !submitting
  const helper = useMemo(() => {
    if (trimmed.length === 0) return 'Describe the outcome you want. The backend will route it only when a delivery channel is configured.'
    if (trimmed.length < 10) return 'Add a little more detail so the agent can understand the task.'
    return `${trimmed.length} characters ready to send.`
  }, [trimmed])

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
      ])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="task-intake" className="task-intake-card" aria-labelledby="task-intake-title">
      <div className="task-intake-copy">
        <span className="data-proof-pill good">New Loop Task</span>
        <h2 id="task-intake-title">Send a task or project into Loop Engineering</h2>
        <p>
          Write what you want the agents to do. The dashboard sends it to a backend intake endpoint, which can forward to a Telegram bot or worker webhook and then shows the process status here.
        </p>
      </div>

      <div className="task-intake-layout">
        <div className="task-form-panel">
          <label htmlFor="loop-task-text">Task / project brief</label>
          <textarea
            id="loop-task-text"
            value={task}
            onChange={(event) => setTask(event.target.value)}
            placeholder="Example: Start a new Loop Engineering project to review failed agent runs, find the root cause, and create a safe improvement proposal."
            rows={6}
          />
          <p className="task-helper">{helper}</p>

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
            <button type="button" className="action-button primary" disabled={!canSubmit} onClick={() => void submit()}>
              {submitting ? 'Sending…' : 'Send task'}
            </button>
            <button type="button" className="action-button" onClick={() => setTask(samplePrompts[1])}>
              Use project example
            </button>
          </div>

          {error && <p className="task-error" role="alert">{error}</p>}
          {result && (
            <div className={`task-result ${result.status}`}>
              <strong>{result.status === 'delivered' ? 'Delivered' : result.status === 'blocked_config' ? 'Configuration required' : 'Delivery failed'}</strong>
              <span>{result.message}</span>
              <code>{result.taskId}</code>
            </div>
          )}
        </div>

        <aside className="process-panel" aria-label="Task delivery process">
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
          <div className="process-note">
            <strong>Delivery channels</strong>
            <span>Configure `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` or `LOOP_TASK_WEBHOOK_URL` in Vercel to make the Send button dispatch behind the scenes.</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
