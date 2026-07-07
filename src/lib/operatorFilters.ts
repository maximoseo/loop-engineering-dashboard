import type { ImprovementProposal, Iteration, ProposalStatus, ProposalType } from '../types.ts'

export type RiskFilter = 'all' | ImprovementProposal['risk_level']
export type ProposalStatusFilter = 'all' | ProposalStatus
export type ProposalTypeFilter = 'all' | ProposalType

export interface ImprovementFilters {
  query?: string
  status?: ProposalStatusFilter
  risk?: RiskFilter
  type?: ProposalTypeFilter
}

export interface IterationFilters {
  query?: string
  minScore?: number
}

const includes = (value: string, query = '') => value.toLowerCase().includes(query.trim().toLowerCase())

export function filterImprovements(rows: ImprovementProposal[], filters: ImprovementFilters): ImprovementProposal[] {
  const query = filters.query?.trim().toLowerCase() ?? ''
  return rows.filter((row) => {
    const matchesQuery =
      !query ||
      includes(row.id, query) ||
      includes(row.target, query) ||
      includes(row.description, query) ||
      includes(row.status, query) ||
      includes(row.type, query)
    const matchesStatus = !filters.status || filters.status === 'all' || row.status === filters.status
    const matchesRisk = !filters.risk || filters.risk === 'all' || row.risk_level === filters.risk
    const matchesType = !filters.type || filters.type === 'all' || row.type === filters.type
    return matchesQuery && matchesStatus && matchesRisk && matchesType
  })
}

export function filterIterations(rows: Iteration[], filters: IterationFilters): Iteration[] {
  const query = filters.query?.trim().toLowerCase() ?? ''
  return rows.filter((row) => {
    const matchesQuery = !query || includes(row.id, query) || includes(row.task, query)
    const matchesScore = filters.minScore === undefined || row.score.total >= filters.minScore
    return matchesQuery && matchesScore
  })
}

export function proposalApprovalCommand(proposalId: string): string {
  return `python scripts/loopctl.py approve ${proposalId.replace(/[^a-zA-Z0-9_.:-]/g, '')}`
}
