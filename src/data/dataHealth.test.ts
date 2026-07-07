import { describe, expect, it } from 'vitest'
import { buildDataHealth, requiredLoopTables } from './dataHealth.ts'
import type { LoopTableName } from '../types.ts'

const allCounts = (value: number) =>
  Object.fromEntries(requiredLoopTables.map((table) => [table, value])) as Record<LoopTableName, number | null>

describe('buildDataHealth', () => {
  it('marks populated Supabase tables as live and fresh', () => {
    const health = buildDataHealth({
      tableCounts: allCounts(3),
      errors: [],
      startedAt: 1000,
      finishedAt: 1250,
      now: new Date('2026-07-07T12:00:00Z'),
    })

    expect(health.mode).toBe('live')
    expect(health.source).toBe('supabase')
    expect(health.fetchDurationMs).toBe(250)
    expect(health.errors).toEqual([])
    expect(health.staleTables).toEqual([])
  })

  it('uses demo mode when the primary iteration table is empty', () => {
    const health = buildDataHealth({
      tableCounts: {
        loop_iterations: 0,
        loop_state: 1,
        loop_scores: 0,
        loop_proposals: 0,
        loop_failure_patterns: 0,
        loop_lessons: 0,
        loop_eval_results: 0,
      },
      errors: [],
      startedAt: 1000,
      finishedAt: 1100,
      now: new Date('2026-07-07T12:00:00Z'),
    })

    expect(health.mode).toBe('demo')
    expect(health.source).toBe('mock')
    expect(health.errors).toContain('loop_iterations has no rows')
  })

  it('marks partial mode when optional operational tables fail but iterations exist', () => {
    const health = buildDataHealth({
      tableCounts: {
        loop_iterations: 40,
        loop_state: 1,
        loop_scores: 40,
        loop_proposals: null,
        loop_failure_patterns: 56,
        loop_lessons: 109,
        loop_eval_results: 44,
      },
      errors: ['loop_proposals: HTTP 500'],
      startedAt: 1000,
      finishedAt: 1800,
      now: new Date('2026-07-07T12:00:00Z'),
    })

    expect(health.mode).toBe('partial')
    expect(health.source).toBe('supabase')
    expect(health.staleTables).toContain('loop_proposals')
    expect(health.errors).toContain('loop_proposals: HTTP 500')
  })
})
