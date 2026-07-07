import type { DataHealth, DataHealthMode, LoopTableName } from '../types.ts'

export const requiredLoopTables = [
  'loop_iterations',
  'loop_state',
  'loop_scores',
  'loop_proposals',
  'loop_failure_patterns',
  'loop_lessons',
  'loop_eval_results',
] as const satisfies readonly LoopTableName[]

interface BuildDataHealthInput {
  tableCounts: Record<LoopTableName, number | null>
  errors: string[]
  startedAt: number
  finishedAt: number
  now?: Date
}

export function buildDataHealth({
  tableCounts,
  errors,
  startedAt,
  finishedAt,
  now = new Date(),
}: BuildDataHealthInput): DataHealth {
  const staleTables = requiredLoopTables.filter((table) => tableCounts[table] === null)
  const mergedErrors = [...errors]
  let mode: DataHealthMode = 'live'
  let source: DataHealth['source'] = 'supabase'

  if ((tableCounts.loop_iterations ?? 0) === 0) {
    mode = 'demo'
    source = 'mock'
    if (!mergedErrors.includes('loop_iterations has no rows')) {
      mergedErrors.push('loop_iterations has no rows')
    }
  } else if (errors.length > 0 || staleTables.length > 0) {
    mode = 'partial'
  }

  if (requiredLoopTables.every((table) => tableCounts[table] === null)) {
    mode = 'error'
    source = 'supabase'
  }

  return {
    mode,
    source,
    lastSuccessfulFetch: mode === 'error' ? null : now.toISOString(),
    fetchDurationMs: Math.max(0, Math.round(finishedAt - startedAt)),
    tableCounts,
    staleTables,
    errors: mergedErrors,
  }
}

export function emptyDataHealth(message = 'Waiting for first data sync'): DataHealth {
  return {
    mode: 'demo',
    source: 'mock',
    lastSuccessfulFetch: null,
    fetchDurationMs: null,
    tableCounts: Object.fromEntries(requiredLoopTables.map((table) => [table, null])) as Record<LoopTableName, number | null>,
    staleTables: [...requiredLoopTables],
    errors: [message],
  }
}
