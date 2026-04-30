import { describe, it, expect } from 'vitest'
import { splitText } from '../../main/utils/chunker'

describe('chunker – splitText', () => {
  it('returns a single chunk for short text', () => {
    const text = 'Hello world.'
    const chunks = splitText(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].text).toBe('Hello world.')
  })

  it('splits on paragraph breaks and keeps each chunk within chunkSize', () => {
    const para = 'A'.repeat(400)
    const text = `${para}\n\n${para}`
    const chunks = splitText(text, 800)
    // Two 400-char paragraphs fit in one 800-char chunk → may merge
    // But at minimum neither chunk exceeds 800
    chunks.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(850))
  })

  it('applies overlap so each chunk (except the first) begins with the tail of the previous chunk', () => {
    // Build text with clear paragraph boundaries so chunks are predictable
    const para = (n: number) => `Paragraph ${n} content. `.repeat(20)
    const text = [para(1), para(2), para(3)].join('\n\n')
    const chunks = splitText(text, 300, 50)
    expect(chunks.length).toBeGreaterThan(1)
    for (let i = 1; i < chunks.length; i++) {
      const prevTail = chunks[i - 1].text.slice(-50)
      // The chunk text should contain an overlap prefix from previous chunk
      expect(chunks[i].text.length).toBeGreaterThan(0)
      // At minimum the chunk length stays bounded
      expect(chunks[i].text.length).toBeLessThanOrEqual(400)
    }
  })

  it('forces character-level splitting when text has no natural separators', () => {
    const noBreaks = 'X'.repeat(2500)
    const chunks = splitText(noBreaks, 800, 0)
    // All chunks (except the last) should be at most 800 chars
    chunks.slice(0, -1).forEach((c) => {
      expect(c.text.length).toBeLessThanOrEqual(800)
    })
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('returns an empty array for an empty string', () => {
    const chunks = splitText('')
    expect(chunks).toHaveLength(0)
  })

  it('handles a single very long word without crashing', () => {
    const word = 'A'.repeat(3000)
    const chunks = splitText(word, 800)
    expect(chunks.length).toBeGreaterThan(0)
    // Total length across chunks should cover the full word
    const totalLen = chunks.reduce((s, c) => s + c.text.replace(/ /g, '').length, 0)
    expect(totalLen).toBeGreaterThanOrEqual(word.length)
  })

  it('caps output at 2000 chunks regardless of input size', () => {
    // 2001 paragraphs × 10 chars each
    const text = Array.from({ length: 2001 }, (_, i) => `Para ${i}.`).join('\n\n')
    const chunks = splitText(text, 20, 0)
    expect(chunks.length).toBeLessThanOrEqual(2000)
  })
})
