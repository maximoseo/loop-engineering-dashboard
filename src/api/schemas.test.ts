import { describe, it, expect } from 'vitest'
import {
  LoopTaskCreateSchema,
  OrchestratorProjectSchema,
  OrchestratorRunSchema,
  OrchestratorAssignmentSchema,
  OrchestratorActionSchema,
  ProposalApproveSchema,
  WorkerClaimSchema,
  validate,
} from '../../api/schemas.ts'

describe('LoopTaskCreateSchema', () => {
  it('accepts minimal valid task', () => {
    const result = validate(LoopTaskCreateSchema, { task: 'Run an SEO audit on example.com' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.task).toBe('Run an SEO audit on example.com')
      expect(result.data.kind).toBeUndefined()
    }
  })

  it('rejects task shorter than 10 chars', () => {
    const result = validate(LoopTaskCreateSchema, { task: 'short' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('10')
  })

  it('rejects task longer than 4000 chars', () => {
    const result = validate(LoopTaskCreateSchema, { task: 'x'.repeat(4001) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid kind', () => {
    const result = validate(LoopTaskCreateSchema, { task: 'Valid task here', kind: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid fields', () => {
    const result = validate(LoopTaskCreateSchema, {
      task: 'Full task with all fields',
      kind: 'agent-run',
      priority: 'high',
      destination: 'telegram',
      expectedResult: 'JSON report',
      contextUrl: 'https://example.com',
      bot: 'my-bot',
      model: 'claude',
      effort: 'high',
      parentTaskId: 'task-123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty body gracefully', () => {
    const result = validate(LoopTaskCreateSchema, {})
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('task')
  })
})

describe('OrchestratorProjectSchema', () => {
  it('accepts minimal project', () => {
    const result = validate(OrchestratorProjectSchema, { name: 'Test Project' })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = validate(OrchestratorProjectSchema, { objective: 'No name' })
    expect(result.success).toBe(false)
  })
})

describe('OrchestratorRunSchema', () => {
  it('accepts minimal run', () => {
    const result = validate(OrchestratorRunSchema, { projectId: 'proj-123' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid mode', () => {
    const result = validate(OrchestratorRunSchema, { projectId: 'proj-123', mode: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('OrchestratorAssignmentSchema', () => {
  it('accepts valid assignment', () => {
    const result = validate(OrchestratorAssignmentSchema, {
      runId: 'run-1',
      projectId: 'proj-1',
      agentId: 'agent-1',
      task: 'Build the frontend component',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const result = validate(OrchestratorAssignmentSchema, { runId: 'run-1' })
    expect(result.success).toBe(false)
  })
})

describe('OrchestratorActionSchema', () => {
  it('accepts bounded worker events', () => {
    expect(validate(OrchestratorActionSchema, {
      action: 'workerEvent',
      runId: 'run-1',
      eventType: 'output',
      message: 'Completed.',
    }).success).toBe(true)
  })

  it('rejects oversized worker output and invalid operator budgets', () => {
    expect(validate(OrchestratorActionSchema, {
      action: 'workerEvent',
      runId: 'run-1',
      eventType: 'output',
      message: 'x'.repeat(4001),
    }).success).toBe(false)
    expect(validate(OrchestratorActionSchema, {
      action: 'createRun',
      name: 'Run',
      budget: { maxCostUsd: 1000 },
    }).success).toBe(false)
  })
})

describe('ProposalApproveSchema', () => {
  it('accepts valid approval', () => {
    const result = validate(ProposalApproveSchema, { proposalId: 'p-1', action: 'approved', reason: 'Looks good' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = validate(ProposalApproveSchema, { proposalId: 'p-1', action: 'maybe' })
    expect(result.success).toBe(false)
  })
})

describe('WorkerClaimSchema', () => {
  it('accepts valid claim', () => {
    const result = validate(WorkerClaimSchema, {
      workerId: 'w-1',
      assignmentId: 'a-1',
      status: 'done',
      output: 'Task completed successfully',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = validate(WorkerClaimSchema, { workerId: 'w-1', assignmentId: 'a-1', status: 'unknown' })
    expect(result.success).toBe(false)
  })
})

describe('validate helper', () => {
  it('returns structured error on failure', () => {
    const result = validate(LoopTaskCreateSchema, null)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeTruthy()
      expect(typeof result.error).toBe('string')
    }
  })
})
