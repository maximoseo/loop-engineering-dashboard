/**
 * Structured JSON logger for Vercel serverless functions.
 *
 * Every log line is a single JSON object that can be parsed by Vercel's
 * log drain, Datadog, or any JSON-capable log aggregator.
 *
 * Usage:
 *   import { log } from './logger.ts'
 *   log.info('task_submitted', { taskId, destination })
 *   log.error('delivery_failed', { taskId, error: String(err) })
 *
 * PII/sensitive fields (task text, emails, tokens) must NEVER be logged.
 * Use redacted keys: taskId, assignmentId, runId are safe.
 */

type Level = 'info' | 'warn' | 'error'

interface LogEntry {
  ts: string
  level: Level
  event: string
  [key: string]: unknown
}

function emit(level: Level, event: string, extra?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...extra,
  }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const log = {
  info: (event: string, extra?: Record<string, unknown>) => emit('info', event, extra),
  warn: (event: string, extra?: Record<string, unknown>) => emit('warn', event, extra),
  error: (event: string, extra?: Record<string, unknown>) => emit('error', event, extra),
}
