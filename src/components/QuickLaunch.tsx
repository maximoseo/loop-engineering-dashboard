import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

const BOTS = ['Auto', 'Planner', 'Backend Builder', 'Frontend Builder', 'QA Verifier', 'Security Guard', 'SEO Researcher', 'Orchestrator']
const MODELS = ['Auto', 'Claude Opus', 'Claude Sonnet', 'GPT-5', 'Gemini', 'MiniMax M3', 'Kimi K2', 'GLM 5', 'DeepSeek V4']
const EFFORTS = ['low', 'medium', 'high', 'max']
const PRIORITIES = ['normal', 'high', 'urgent']

const TERMINAL = new Set(['done', 'failed', 'blocked_config', 'archived', 'needs_review'])
const ACTIVE = new Set(['queued', 'delivered', 'accepted', 'running', 'needs_review'])

const EVENT_LABELS: Record<string, string> = {
  task_created: 'Created', delivery_succeeded: 'Delivered', delivery_blocked: 'Delivery blocked',
  accepted: 'Accepted', running: 'Running', processing_started: 'Processing started',
  result_ready: 'Result ready', needs_review: 'Needs review', done: 'Done', failed: 'Failed',
}
const eventLabel = (t: string) => EVENT_LABELS[t] || t.replace(/_/g, ' ')

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued', delivered: 'Delivered', accepted: 'Accepted', running: 'Running',
  needs_review: 'Needs review', done: 'Done', failed: 'Failed', blocked_config: 'Config required',
}

interface Result {
  ok: boolean
  taskId?: string
  status?: string
  message?: string
}

interface TaskEvent {
  id?: string
  created_at: string
  event_type: string
  message: string
}

export function QuickLaunch() {
  const [task, setTask] = useState('')
  const [bot, setBot] = useState('Auto')
  const [model, setModel] = useState('Auto')
  const [effort, setEffort] = useState('medium')
  const [priority, setPriority] = useState('normal')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [resultSummary, setResultSummary] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }
  useEffect(() => () => stopPolling(), [])

  const startPolling = (taskId: string) => {
    stopPolling()
    let tries = 0
    let inFlight = false
    const tick = async () => {
      if (inFlight) return // don't overlap if a poll is slower than the interval
      inFlight = true
      tries += 1
      try {
        const res = await fetch(`/api/loop-task?taskId=${encodeURIComponent(taskId)}`)
        if (res.ok) {
          const json = await res.json() as { tasks?: Array<{ status?: string; result_summary?: string }>; events?: TaskEvent[] }
          const t = json.tasks?.[0]
          setEvents(json.events || [])
          if (t?.status) setLiveStatus(t.status)
          if (t?.result_summary) setResultSummary(t.result_summary)
          if (t?.status && (TERMINAL.has(t.status) || !ACTIVE.has(t.status))) stopPolling()
        }
      } catch { /* keep last known */ } finally { inFlight = false }
      if (tries >= 120) stopPolling() // ~3 min safety cap
    }
    void tick()
    pollRef.current = setInterval(() => void tick(), 1500)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (task.trim().length < 10) {
      setResult({ ok: false, message: 'Task must be at least 10 characters.' })
      return
    }
    setSending(true)
    setResult(null)
    setEvents([])
    setLiveStatus(null)
    setResultSummary(null)
    stopPolling()
    try {
      const res = await fetch('/api/loop-task', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: task.trim(), kind: 'dashboard', priority, bot, model, effort }),
      })
      const payload = await res.json()
      setResult({ ok: Boolean(payload.ok), taskId: payload.taskId, status: payload.status, message: payload.message })
      if (payload.ok && payload.taskId) {
        setLiveStatus(payload.status || 'delivered')
        // Seed the timeline immediately so the process is visible the instant
        // the task is accepted — polling then fills in accepted/running/done.
        const now = new Date().toISOString()
        setEvents([
          { event_type: 'task_created', message: 'Task created in persistent queue.', created_at: now },
          { event_type: 'delivery_succeeded', message: payload.message || 'Delivered.', created_at: now },
        ])
        setTask('')
        startPolling(payload.taskId)
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to send task.' })
    } finally {
      setSending(false)
    }
  }

  const isActive = liveStatus != null && ACTIVE.has(liveStatus) && !TERMINAL.has(liveStatus)
  const waitingForWorker = liveStatus === 'delivered' && events.length > 0 &&
    events.every((ev) => ['task_created', 'delivery_succeeded', 'delivery_blocked'].includes(ev.event_type))

  return (
    <section className="quicklaunch glass-card" aria-label="Launch a task">
      <div className="quicklaunch-head">
        <p className="eyebrow">Launch</p>
        <h3 className="section-header">Send a task to the loop</h3>
        <p className="quicklaunch-sub">Describe the work, pick a bot, model and effort — it is queued, delivered, and tracked live below.</p>
      </div>
      <form onSubmit={submit} className="quicklaunch-form">
        <textarea
          className="quicklaunch-textarea"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="e.g. Audit the homepage for Core Web Vitals and propose concrete fixes…"
          rows={3}
        />
        <div className="quicklaunch-controls">
          <label>Bot<select value={bot} onChange={(e) => setBot(e.target.value)}>{BOTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Model<select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Effort<select value={effort} onChange={(e) => setEffort(e.target.value)}>{EFFORTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Priority<select value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <button type="submit" className="primary-action" disabled={sending}>{sending ? 'Sending…' : 'Send to loop'}</button>
        </div>
      </form>

      {result && (
        <div className={`quicklaunch-result ${result.ok ? 'ok' : 'err'}`} role="status">
          <p>
            {result.ok ? '✓' : '✕'} {result.message}
            {liveStatus && (
              <span className={`quicklaunch-status-pill ${liveStatus}`}>
                {isActive && <span className="quicklaunch-dot" aria-hidden="true" />}
                {STATUS_LABELS[liveStatus] || liveStatus}
              </span>
            )}
          </p>
          {result.taskId && (
            <p className="quicklaunch-meta">
              <span>Task <code>{result.taskId}</code></span>
              <Link to="/queue">Open in Task queue →</Link>
            </p>
          )}
        </div>
      )}

      {result?.ok && events.length > 0 && (
        <div className="quicklaunch-progress" aria-label="Live task progress">
          <p className="eyebrow">Progress {isActive && <span className="quicklaunch-dot" aria-hidden="true" />}</p>
          <ol className="event-timeline">
            {events.map((ev, i) => (
              <li key={ev.id || `${i}-${ev.event_type}`} className={ev.event_type}>
                <span aria-hidden="true" />
                <div>
                  <strong>{eventLabel(ev.event_type)}</strong>
                  <small>{ev.message}</small>
                </div>
              </li>
            ))}
          </ol>
          {waitingForWorker && (
            <p className="quicklaunch-hint">Delivered to Telegram and saved. Waiting for a worker to pick it up — it advances here automatically once processing starts.</p>
          )}
          {resultSummary && (
            <div className="drawer-result-summary">
              <p className="section-kicker">Result</p>
              <pre>{resultSummary}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
