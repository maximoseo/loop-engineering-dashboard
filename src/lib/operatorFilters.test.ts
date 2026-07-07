import { describe, expect, it } from 'vitest'
import type { ImprovementProposal, Iteration } from '../types.ts'
import { filterImprovements, filterIterations, proposalApprovalCommand } from './operatorFilters.ts'

const proposal = (overrides: Partial<ImprovementProposal>): ImprovementProposal => ({
  id: 'prop-1',
  timestamp: 'today',
  type: 'skill',
  target: 'Loop-Managed/Verify-Task-Scope/SKILL.md',
  description: 'Adds a verification guardrail',
  status: 'pending_approval',
  risk_level: 'medium',
  eval_score_before: 80,
  eval_score_after: 88,
  ...overrides,
})

const iteration = (overrides: Partial<Iteration>): Iteration => ({
  id: 'task_abc123',
  timestamp: 'today',
  task: 'Improve dashboard reliability',
  score: {
    task_success: 25,
    accuracy: 14,
    user_alignment: 14,
    tool_quality: 8,
    efficiency: 8,
    safety: 10,
    validation: 5,
    memory_learning: 4,
    total: 88,
  },
  lessons_extracted: 2,
  proposals_made: 1,
  tools_used: 4,
  token_usage: 12000,
  duration_seconds: 300,
  ...overrides,
})

describe('operator filters', () => {
  it('filters improvements by search, status, risk and type', () => {
    const rows = [
      proposal({ id: 'a', status: 'active', risk_level: 'low', type: 'skill', target: 'Verify-Task-Scope' }),
      proposal({ id: 'b', status: 'rejected', risk_level: 'high', type: 'prompt', target: 'Manual Prompt' }),
    ]

    expect(filterImprovements(rows, { query: 'verify', status: 'active', risk: 'low', type: 'skill' }).map((row) => row.id)).toEqual(['a'])
  })

  it('filters iterations by text and minimum score', () => {
    const rows = [iteration({ id: 'a', task: 'Improve dashboard reliability', score: { ...iteration({}).score, total: 91 } }), iteration({ id: 'b', task: 'Tiny task', score: { ...iteration({}).score, total: 60 } })]

    expect(filterIterations(rows, { query: 'dashboard', minScore: 85 }).map((row) => row.id)).toEqual(['a'])
  })

  it('builds a safe copy-only approval command', () => {
    expect(proposalApprovalCommand('prop-123')).toBe('python scripts/loopctl.py approve prop-123')
  })
})
