/**
 * Telegram notification triggers for loop engineering events.
 * Uses existing api/loop-task.ts infrastructure for sending.
 */

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3000'

interface NotificationPayload {
  event: string
  message: string
  priority: 'normal' | 'high' | 'urgent'
  metadata?: Record<string, unknown>
}

export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: payload.message,
        kind: 'dashboard',
        priority: payload.priority,
        destination: 'auto',
        metadata: { event: payload.event, ...payload.metadata },
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

/** Score dropped below threshold */
export function notifyScoreDrop(score: number, threshold: number = 50) {
  if (score >= threshold) return
  sendNotification({
    event: 'score_drop',
    message: `⚠️ Loop score dropped to ${score}/100 (threshold: ${threshold}). Proposals pending review may help.`,
    priority: 'high',
    metadata: { score, threshold },
  })
}

/** New proposal ready for review */
export function notifyNewProposal(proposalId: string, type: string) {
  sendNotification({
    event: 'new_proposal',
    message: `📋 New ${type} proposal ${proposalId.slice(0, 12)} ready for review.`,
    priority: 'normal',
    metadata: { proposalId, type },
  })
}

/** Failure pattern detected */
export function notifyFailurePattern(pattern: string, count: number) {
  sendNotification({
    event: 'failure_pattern',
    message: `🔴 Failure pattern "${pattern}" detected ${count}x in recent runs.`,
    priority: 'urgent',
    metadata: { pattern, count },
  })
}

/** Worker offline */
export function notifyWorkerOffline() {
  sendNotification({
    event: 'worker_offline',
    message: '⚠️ Loop worker appears offline. New tasks will queue until it reconnects.',
    priority: 'high',
  })
}

/** Daily digest */
export function notifyDailyDigest(stats: {
  avgScore: number
  proposalsOpen: number
  proposalsApproved: number
  topFailure: string
  iterations: number
}) {
  sendNotification({
    event: 'daily_digest',
    message: [
      '📊 Daily Loop Engineering Digest',
      `• Avg Score: ${stats.avgScore}/100`,
      `• Proposals: ${stats.proposalsOpen} open, ${stats.proposalsApproved} approved`,
      `• Top Failure: ${stats.topFailure}`,
      `• Iterations: ${stats.iterations}`,
    ].join('\n'),
    priority: 'normal',
    metadata: stats,
  })
}
