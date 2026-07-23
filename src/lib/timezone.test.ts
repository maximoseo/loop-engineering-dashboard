import { describe, it, expect } from 'vitest'
import { formatTimestamp, formatTime } from './loopFormat.ts'

describe('timezone formatting', () => {
  it('formats UTC timestamp in Jerusalem timezone', () => {
    // 2026-07-23T10:00:00Z → 13:00 in Jerusalem (IDT, UTC+3)
    const result = formatTimestamp('2026-07-23T10:00:00Z')
    expect(result).toContain('13:00')
    expect(result).toContain('Jul')
    expect(result).toContain('2026')
  })

  it('formats time-only in Jerusalem timezone', () => {
    const result = formatTime('2026-07-23T10:00:00Z')
    expect(result).toBe('13:00')
  })

  it('returns em-dash for null/undefined', () => {
    expect(formatTimestamp(null)).toBe('—')
    expect(formatTimestamp(undefined)).toBe('—')
    expect(formatTime(null)).toBe('—')
  })
})
