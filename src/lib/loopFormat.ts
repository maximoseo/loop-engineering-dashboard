import type { CostSummary } from '../types.ts'

/**
 * Turn a managed-skill target path into a readable label.
 * Loop proposal targets look like `...\Loop-Managed\Secret-Lesson-Sanitization\SKILL.md`,
 * where the meaningful name is the parent folder; other `.md` files keep their own name.
 */
export function humanizeTarget(raw: string): string {
  if (!raw) return 'Proposal'
  const parts = raw.split(/[\\/]/).filter(Boolean)
  let seg = parts[parts.length - 1] || raw
  if (/^skill\.md$/i.test(seg) && parts.length > 1) seg = parts[parts.length - 2]
  return seg
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const META_TASK_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^you are a strict evaluation judge/i, 'Loop self-scoring session'],
  [/^you extract reusable lessons/i, 'Lesson-extraction session'],
  [/^you are an? (expert )?(proposal|improvement|skill)/i, 'Proposal-generation session'],
]

/**
 * Some observed sessions are the loop's own scoring / lesson-extraction calls, whose
 * `user_request` is a long judge prompt. Show a friendly label for those instead of
 * leaking the raw prompt; everything else is returned unchanged.
 */
export function cleanIterationTask(text: string): string {
  const t = (text || '').trim()
  if (!t) return 'Untitled task'
  for (const [pattern, label] of META_TASK_PATTERNS) {
    if (pattern.test(t)) return label
  }
  return t
}

export interface CostRowLike {
  model?: string | null
  provider?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  estimated_cost_usd?: number | null
}

/** Aggregate cost events into totals + a per-model breakdown sorted by spend. */
export function summarizeCost(rows: readonly CostRowLike[]): CostSummary {
  const byModel = new Map<string, { input: number; output: number; cost: number; events: number }>()
  let totIn = 0
  let totOut = 0
  let totCost = 0
  for (const c of rows) {
    const key = c.model || c.provider || 'unknown'
    const g = byModel.get(key) ?? { input: 0, output: 0, cost: 0, events: 0 }
    g.input += Number(c.input_tokens || 0)
    g.output += Number(c.output_tokens || 0)
    g.cost += Number(c.estimated_cost_usd || 0)
    g.events += 1
    byModel.set(key, g)
    totIn += Number(c.input_tokens || 0)
    totOut += Number(c.output_tokens || 0)
    totCost += Number(c.estimated_cost_usd || 0)
  }
  return {
    total_input_tokens: totIn,
    total_output_tokens: totOut,
    total_cost_usd: totCost,
    events: rows.length,
    by_model: [...byModel.entries()]
      .map(([key, g]) => ({ key, input_tokens: g.input, output_tokens: g.output, cost_usd: g.cost, events: g.events }))
      .sort((a, b) => b.cost_usd - a.cost_usd),
  }
}
