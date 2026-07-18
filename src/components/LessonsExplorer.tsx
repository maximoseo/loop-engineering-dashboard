import { useState, useMemo } from 'react'
import type { BacklogItem, FailurePattern, ImprovementProposal, Iteration } from '../types'

type LessonLike = {
  id: string
  type: string
  target: string
  content: string
  applied: boolean
  confidence: number
  created_at: string
}

interface LessonsExplorerProps {
  lessons: LessonLike[]
}

export function LessonsExplorer({ lessons }: LessonsExplorerProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sort, setSort] = useState<'newest' | 'confidence'>('newest')

  const filtered = useMemo(() => {
    let result = [...lessons]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        l.content.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'all') {
      result = result.filter(l => l.type === typeFilter)
    }
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === 'confidence') result.sort((a, b) => b.confidence - a.confidence)
    return result
  }, [lessons, search, typeFilter, sort])

  const types = useMemo(() => ['all', ...new Set(lessons.map(l => l.type))], [lessons])
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of lessons) counts[l.type] = (counts[l.type] || 0) + 1
    return counts
  }, [lessons])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search lessons..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] w-64 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)]"
        >
          {types.map(t => (
            <option key={t} value={t}>{t} {typeCounts[t] ? `(${typeCounts[t]})` : ''}</option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)]"
        >
          <option value="newest">Newest first</option>
          <option value="confidence">Highest confidence</option>
        </select>
        <span className="text-xs text-[var(--text-secondary)] ml-auto">{filtered.length} lessons</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-secondary)]">
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Content</th>
              <th className="p-2 font-medium">Target</th>
              <th className="p-2 font-medium text-right">Confidence</th>
              <th className="p-2 font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(l => (
              <tr key={l.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--card)]/50">
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    l.type === 'pitfall' ? 'bg-red-500/20 text-red-400' :
                    l.type === 'optimization' ? 'bg-green-500/20 text-green-400' :
                    l.type === 'preference' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>{l.type}</span>
                </td>
                <td className="p-2 max-w-md truncate text-[var(--text)]">{l.content}</td>
                <td className="p-2 text-[var(--text-secondary)]">{l.target}</td>
                <td className="p-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <div className="w-12 h-1.5 rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(l.confidence * 100)}%` }} />
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">{Math.round(l.confidence * 100)}%</span>
                  </div>
                </td>
                <td className="p-2">{l.applied ? '✅' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
