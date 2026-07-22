/**
 * Shared Zod schemas for API request validation.
 * Uses .optional() instead of .default() to avoid Zod 4 type issues.
 * Defaults are applied in the validate() helper.
 */
import { z } from 'zod'

// ── loop-task ─────────────────────────────────────────────────

export const LoopTaskCreateSchema = z.object({
  task: z.string().min(10).max(4000),
  kind: z.enum(['agent-run', 'project', 'debug', 'dashboard', 'proposal']).optional(),
  priority: z.enum(['normal', 'high', 'urgent']).optional(),
  destination: z.enum(['auto', 'telegram', 'worker-webhook']).optional(),
  expectedResult: z.string().max(1000).optional(),
  contextUrl: z.string().max(1000).optional(),
  bot: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  effort: z.enum(['low', 'medium', 'high', 'max']).optional(),
  parentTaskId: z.string().max(80).optional(),
})

export type LoopTaskCreate = z.infer<typeof LoopTaskCreateSchema>

// ── orchestrator: project ─────────────────────────────────────

export const OrchestratorProjectSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().max(2000).optional(),
  scope: z.record(z.string(), z.unknown()).optional(),
  constraints: z.array(z.string().max(200)).max(20).optional(),
  successCriteria: z.array(z.string().max(200)).max(20).optional(),
})

export type OrchestratorProject = z.infer<typeof OrchestratorProjectSchema>

// ── orchestrator: run ─────────────────────────────────────────

export const OrchestratorRunSchema = z.object({
  projectId: z.string().min(1).max(80),
  mode: z.enum(['lead_agent', 'parallel_specialists', 'debate', 'pipeline', 'swarm_verify']).optional(),
  maxCostUsd: z.number().min(0).max(100).optional(),
  maxParallelAgents: z.number().int().min(1).max(20).optional(),
  maxRuntimeMinutes: z.number().int().min(1).max(480).optional(),
  strategy: z.record(z.string(), z.unknown()).optional(),
})

export type OrchestratorRun = z.infer<typeof OrchestratorRunSchema>

// ── orchestrator: assignment ──────────────────────────────────

export const OrchestratorAssignmentSchema = z.object({
  runId: z.string().min(1).max(80),
  projectId: z.string().min(1).max(80),
  agentId: z.string().min(1).max(80),
  modelProfileId: z.string().max(80).optional(),
  task: z.string().min(1).max(4000),
  constraints: z.array(z.string().max(200)).max(20).optional(),
  maxTokens: z.number().int().min(0).optional(),
  maxCostUsd: z.number().min(0).max(50).optional(),
  maxDurationMinutes: z.number().int().min(1).max(120).optional(),
})

export type OrchestratorAssignment = z.infer<typeof OrchestratorAssignmentSchema>

// ── orchestrator: event ───────────────────────────────────────

export const OrchestratorEventSchema = z.object({
  assignmentId: z.string().max(80).optional(),
  runId: z.string().min(1).max(80),
  eventType: z.enum(['status_change', 'heartbeat', 'error', 'output', 'artifact', 'cost', 'custom']),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export type OrchestratorEvent = z.infer<typeof OrchestratorEventSchema>

// ── proposal-approve ──────────────────────────────────────────

export const ProposalApproveSchema = z.object({
  proposalId: z.string().min(1).max(80),
  action: z.enum(['approved', 'rejected']),
  reason: z.string().max(500).optional(),
})

export type ProposalApprove = z.infer<typeof ProposalApproveSchema>

// ── worker claim ──────────────────────────────────────────────

export const WorkerClaimSchema = z.object({
  workerId: z.string().min(1).max(80),
  assignmentId: z.string().min(1).max(80),
  output: z.string().max(50_000).optional(),
  artifacts: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  status: z.enum(['done', 'failed', 'needs_review']),
})

export type WorkerClaim = z.infer<typeof WorkerClaimSchema>

// ── helpers ───────────────────────────────────────────────────

/**
 * Parse and validate a request body. Returns { success, data, error }.
 * On failure, `error` is a safe, client-facing string.
 */
export function validate<T>(schema: z.ZodSchema<T>, body: unknown):
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string } {
  const result = schema.safeParse(body)
  if (result.success) return { success: true, data: result.data, error: null }
  const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
  return { success: false, data: null, error: messages.join('; ') }
}
