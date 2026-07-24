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

// ── orchestrator API actions ──────────────────────────────────

const IdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/)
const ShortTextSchema = z.string().max(500)
const MetadataSchema = z.record(z.string(), z.unknown())

export const OrchestratorActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('createRun'),
    name: z.string().min(1).max(120),
    objective: z.string().max(4000).optional(),
    mode: z.enum(['lead_agent', 'parallel_specialists', 'debate', 'pipeline', 'swarm_verify']).optional(),
    constraints: z.array(z.string().max(200)).max(20).optional(),
    successCriteria: z.array(z.string().max(200)).max(20).optional(),
    contextUrl: z.string().max(1000).optional(),
    budget: z.object({
      maxParallelAgents: z.number().int().min(1).max(20).optional(),
      maxRuntimeMinutes: z.number().int().min(1).max(480).optional(),
      maxCostUsd: z.number().min(0).max(100).optional(),
    }).optional(),
  }),
  z.object({ action: z.literal('lease'), workerId: IdSchema, agentIds: z.array(IdSchema).max(20).optional() }),
  z.object({
    action: z.literal('workerEvent'),
    workerId: IdSchema,
    runId: IdSchema,
    assignmentId: IdSchema.optional(),
    agentId: IdSchema.optional(),
    eventType: z.string().min(1).max(80),
    message: z.string().max(4000).optional(),
    metadata: MetadataSchema.optional(),
  }),
  z.object({
    action: z.enum(['complete', 'fail', 'needsReview', 'blocked']),
    assignmentId: IdSchema,
    workerId: IdSchema,
    output: MetadataSchema.optional(),
    summary: z.string().max(4000).optional(),
    error: z.string().max(4000).optional(),
  }),
  z.object({
    action: z.literal('createApproval'),
    runId: IdSchema,
    assignmentId: IdSchema.optional(),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    actionType: z.string().min(1).max(80).optional(),
    reason: z.string().max(1000).optional(),
  }),
  z.object({ action: z.enum(['approve', 'reject']), approvalId: IdSchema, reason: ShortTextSchema.optional() }),
])

export type OrchestratorAction = z.infer<typeof OrchestratorActionSchema>

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
