import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

const BOTS = ['Auto', 'Planner', 'Backend Builder', 'Frontend Builder', 'QA Verifier', 'Security Guard', 'SEO Researcher', 'Orchestrator']
const MODELS = ['Auto', 'Claude Opus', 'Claude Sonnet', 'GPT-5', 'Gemini', 'MiniMax M3', 'Kimi K2', 'GLM 5', 'DeepSeek V4']
const EFFORTS = ['low', 'medium', 'high', 'max']
const PRIORITIES = ['normal', 'high', 'urgent']

interface Result {
  ok: boolean
  taskId?: string
  status?: string
  message?: string
}

export function QuickLaunch() {
  const [task, setTask] = useState('')
  const [bot, setBot] = useState('Auto')
  const [model, setModel] = useState('Auto')
  const [effort, setEffort] = useState('medium')
  const [priority, setPriority] = useState('normal')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (task.trim().length < 10) {
      setResult({ ok: false, message: 'Task must be at least 10 characters.' })
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/loop-task', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task: task.trim(), kind: 'dashboard', priority, bot, model, effort }),
      })
      const payload = await res.json()
      setResult({ ok: Boolean(payload.ok), taskId: payload.taskId, status: payload.status, message: payload.message })
      if (payload.ok) setTask('')
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to send task.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="quicklaunch glass-card" aria-label="Launch a task">
      <div className="quicklaunch-head">
        <p className="eyebrow">Launch</p>
        <h3 className="section-header">Send a task to the loop</h3>
        <p className="quicklaunch-sub">Describe the work, pick a bot, model and effort — it is queued, delivered, and saved so you can reach it later.</p>
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
          <p>{result.ok ? '✓' : '✕'} {result.message}</p>
          {result.taskId && (
            <p className="quicklaunch-meta">
              <span>Task <code>{result.taskId}</code> · {result.status}</span>
              <Link to="/queue">Open in Task queue →</Link>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
