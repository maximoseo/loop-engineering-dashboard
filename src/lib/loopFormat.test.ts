import { describe, expect, it } from 'vitest'
import { humanizeTarget, summarizeCost } from './loopFormat.ts'

describe('humanizeTarget', () => {
  it('turns a Windows SKILL.md path into the parent skill name', () => {
    expect(
      humanizeTarget('C:\\Users\\U\\AppData\\Local\\Hermes\\Skills\\Loop-Managed\\Secret-Lesson-Sanitization\\SKILL.Md'),
    ).toBe('Secret Lesson Sanitization')
  })
  it('keeps a non-SKILL .md file name and strips the extension', () => {
    expect(humanizeTarget('a/b/tool-routing.md')).toBe('Tool Routing')
  })
  it('title-cases a plain segment', () => {
    expect(humanizeTarget('memory_safety')).toBe('Memory Safety')
  })
  it('falls back to "Proposal" for empty input', () => {
    expect(humanizeTarget('')).toBe('Proposal')
  })
})

describe('summarizeCost', () => {
  it('aggregates tokens + usd by model, sorted by spend', () => {
    const s = summarizeCost([
      { model: 'gpt', input_tokens: 100, output_tokens: 50, estimated_cost_usd: 0.5 },
      { model: 'gpt', input_tokens: 100, output_tokens: 50, estimated_cost_usd: 0.5 },
      { model: 'claude', input_tokens: 10, output_tokens: 5, estimated_cost_usd: 2 },
    ])
    expect(s.total_input_tokens).toBe(210)
    expect(s.total_output_tokens).toBe(105)
    expect(s.total_cost_usd).toBe(3)
    expect(s.events).toBe(3)
    expect(s.by_model[0].key).toBe('claude') // highest cost first
    expect(s.by_model.find((m) => m.key === 'gpt')?.events).toBe(2)
  })
  it('falls back to provider / unknown and handles nulls', () => {
    const s = summarizeCost([{ input_tokens: 5 }, { provider: 'openai', estimated_cost_usd: 1 }])
    expect(s.events).toBe(2)
    expect(s.by_model.map((m) => m.key).sort()).toEqual(['openai', 'unknown'])
  })
})
