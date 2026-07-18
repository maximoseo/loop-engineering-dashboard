import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
} from 'recharts'

interface ScoreEntry {
  total: number
  task_id: string
  created_at: string
  breakdown: Partial<Record<string, number>>
}

interface ScoreTrendProps {
  scores: ScoreEntry[]
  days?: number
  height?: number
}

export function ScoreTrend({ scores, days = 30, height = 200 }: ScoreTrendProps) {
  const data = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return scores
      .filter(s => new Date(s.created_at).getTime() > cutoff)
      .map(s => ({
        date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: s.total,
        id: s.task_id.slice(0, 8),
      }))
      .slice(-90)
  }, [scores, days])

  if (data.length < 2) {
    return <div className="text-[var(--text-secondary)] text-sm p-4">Not enough data for trend chart (need 2+ scores).</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent, #6366f1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent, #6366f1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #333)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary, #888)' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-secondary, #888)' }} />
        <Tooltip
          contentStyle={{
            background: 'var(--card, #1a1a2e)',
            border: '1px solid var(--border, #333)',
            borderRadius: 8,
            color: 'var(--text, #fff)',
          }}
          labelStyle={{ color: 'var(--text-secondary, #888)' }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--accent, #6366f1)"
          fill="url(#scoreGradient)"
          strokeWidth={2}
          dot={{ r: 2, fill: 'var(--accent, #6366f1)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface RubricBreakdownProps {
  breakdown: Partial<Record<string, number>>
  height?: number
}

export function RubricBreakdown({ breakdown, height = 180 }: RubricBreakdownProps) {
  const data = useMemo(() =>
    Object.entries(breakdown)
      .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Math.round(value ?? 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  [breakdown])

  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #333)" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-secondary, #888)' }} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: 'var(--text, #ccc)' }} />
        <Tooltip
          contentStyle={{
            background: 'var(--card, #1a1a2e)',
            border: '1px solid var(--border, #333)',
            borderRadius: 8,
            color: 'var(--text, #fff)',
          }}
        />
        <Bar dataKey="value" fill="var(--accent, #6366f1)" radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface FailureHistogramProps {
  failures: { created_at: string; severity: string }[]
  weeks?: number
  height?: number
}

export function FailureHistogram({ failures, weeks = 12, height = 180 }: FailureHistogramProps) {
  const data = useMemo(() => {
    const buckets = new Map<string, { week: string; low: number; medium: number; high: number; critical: number }>()
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000

    for (const f of failures) {
      const date = new Date(f.created_at)
      if (date.getTime() < cutoff) continue
      const week = `${date.getFullYear()}-W${String(Math.ceil((date.getDate() + 6 - date.getDay()) / 7)).padStart(2, '0')}`
      if (!buckets.has(week)) buckets.set(week, { week, low: 0, medium: 0, high: 0, critical: 0 })
      const b = buckets.get(week)!
      const sev = f.severity
      if (sev === 'low') b.low++
      else if (sev === 'medium') b.medium++
      else if (sev === 'high') b.high++
      else if (sev === 'critical') b.critical++
    }

    return Array.from(buckets.values())
      .map(v => ({ week: v.week, low: v.low, medium: v.medium, high: v.high, critical: v.critical } as const))
      .sort((a, b) => a.week.localeCompare(b.week))
  }, [failures, weeks])

  if (data.length === 0) {
    return <div className="text-[var(--text-secondary)] text-sm p-4">No failure data for histogram.</div>
  }

  const colors: Record<string, string> = {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444',
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #333)" />
        <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-secondary, #888)' }} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary, #888)' }} />
        <Tooltip
          contentStyle={{
            background: 'var(--card, #1a1a2e)',
            border: '1px solid var(--border, #333)',
            borderRadius: 8,
            color: 'var(--text, #fff)',
          }}
        />
        {Object.entries(colors).map(([key, color]) => (
          <Bar key={key} dataKey={key} stackId="a" fill={color} barSize={20} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
