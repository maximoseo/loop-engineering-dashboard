import { describe, it, expect } from 'vitest'
import { llmModel, firstUrl, auditSite } from '../api/worker'

describe('llmModel', () => {
  it('maps known labels and falls back for unknown ones', () => {
    expect(llmModel('DeepSeek V4')).toBe('deepseek/deepseek-chat')
    expect(llmModel('Auto')).toBe('openai/gpt-4o-mini')
    expect(llmModel('')).toBe('openai/gpt-4o-mini')
  })
})

describe('firstUrl', () => {
  const base = { task_id: 't', status: 'delivered' }
  it('prefers a contextUrl from metadata', () => {
    expect(firstUrl({ ...base, task: 'no url here', metadata: { contextUrl: 'https://a.com/' } })).toBe('https://a.com/')
  })
  it('extracts a URL from the task text', () => {
    expect(firstUrl({ ...base, task: 'audit https://b.com/page for seo', metadata: null })).toBe('https://b.com/page')
  })
  it('ignores a non-http contextUrl and falls through to the text', () => {
    expect(firstUrl({ ...base, task: 'see http://c.com', metadata: { contextUrl: 'not a url' } })).toBe('http://c.com')
  })
  it('returns null when there is no URL', () => {
    expect(firstUrl({ ...base, task: 'write a poem', metadata: {} })).toBeNull()
  })
})

describe('auditSite', () => {
  const badHtml = '<html>' + '<script></script>'.repeat(50) + '<img src=x>' + '</html>'
  const goodHtml =
    '<html lang="en"><head>' +
    '<meta name="viewport" content="width=device-width">' +
    '<link rel="canonical" href="https://x.com/">' +
    '<script type="application/ld+json">{}</script>' +
    '</head><body><h1>Title</h1><h2>Section</h2>' +
    '<img src="a" alt="a"><script></script></body></html>'

  it('flags high-impact problems on a poor page', () => {
    const out = auditSite('https://x.com/', { html: badHtml, links: [] }, 'high')
    expect(out).toContain('Cut JS / page weight')          // 50 scripts >= 40
    expect(out).toContain('Missing <title>')                // no title
    expect(out).toContain('No responsive viewport')         // no viewport
    expect(out).toContain('No <h1>')                        // no h1
  })

  it('credits a well-optimised page and adds few fixes', () => {
    const out = auditSite('https://x.com/', {
      title: 'A clear descriptive page title here',
      description: 'x'.repeat(140),
      ogImage: 'https://x.com/hero.jpg',
      html: goodHtml,
      links: ['a', 'b'],
    }, 'medium')
    expect(out).toContain('Already solid')
    expect(out).toContain('viewport set')
    expect(out).toContain('single H1')
    expect(out).toContain('JSON-LD present')
    expect(out).not.toContain('No responsive viewport')
  })

  it('lets effort control how many fixes are shown', () => {
    const low = auditSite('https://x.com/', { html: badHtml, links: [] }, 'low')
    const high = auditSite('https://x.com/', { html: badHtml, links: [] }, 'high')
    const n = (s: string) => (s.match(/^\d+\. /gm) || []).length
    expect(n(low)).toBeLessThanOrEqual(3)
    expect(n(high)).toBeGreaterThanOrEqual(n(low))
  })
})
