/**
 * Minimal Vitest tests for the CreateEventSchema (Feature 3 & 4 validations).
 * Run with: pnpm test
 */
import { describe, it, expect } from 'vitest'
import { CreateEventSchema } from '@/stores/eventStore'

describe('CreateEventSchema', () => {
  const base = {
    title: 'Test Event',
    startTime: '2025-12-01T18:00',
  }

  it('accepts a minimal valid event', () => {
    const result = CreateEventSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('rejects an event without a title', () => {
    const result = CreateEventSchema.safeParse({ ...base, title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an event without a startTime', () => {
    const result = CreateEventSchema.safeParse({ ...base, startTime: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a negative admissionFee', () => {
    const result = CreateEventSchema.safeParse({ ...base, admissionFee: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects maxParticipants < minParticipants', () => {
    const result = CreateEventSchema.safeParse({
      ...base,
      minParticipants: 10,
      maxParticipants: 5,
    })
    expect(result.success).toBe(false)
    expect(result.error?.errors[0].message).toMatch(/max participants/i)
  })

  it('accepts maxParticipants === minParticipants', () => {
    const result = CreateEventSchema.safeParse({
      ...base,
      minParticipants: 5,
      maxParticipants: 5,
    })
    expect(result.success).toBe(true)
  })

  it('accepts maxParticipants > minParticipants', () => {
    const result = CreateEventSchema.safeParse({
      ...base,
      minParticipants: 2,
      maxParticipants: 20,
    })
    expect(result.success).toBe(true)
  })
})
