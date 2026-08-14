import { describe, expect, it } from 'vitest'
import { normalizeSupabaseProjectUrl } from './client'

describe('normalizeSupabaseProjectUrl', () => {
  it('keeps a normal project origin', () => {
    expect(normalizeSupabaseProjectUrl('https://demo.supabase.co').url)
      .toBe('https://demo.supabase.co')
  })

  it('repairs a REST endpoint accidentally pasted as the project URL', () => {
    const result = normalizeSupabaseProjectUrl('https://demo.supabase.co/rest/v1/')
    expect(result.url).toBe('https://demo.supabase.co')
    expect(result.repairedServiceSuffix).toBe(true)
  })

  it('repairs other Supabase service suffixes too', () => {
    expect(normalizeSupabaseProjectUrl('https://demo.supabase.co/auth/v1').url)
      .toBe('https://demo.supabase.co')
    expect(normalizeSupabaseProjectUrl('https://demo.supabase.co/storage/v1').url)
      .toBe('https://demo.supabase.co')
  })

  it('rejects arbitrary Dashboard/project paths rather than guessing', () => {
    expect(() =>
      normalizeSupabaseProjectUrl('https://supabase.com/dashboard/project/demo'),
    ).toThrow(/project origin only/i)
  })

  it('rejects database connection strings', () => {
    expect(() =>
      normalizeSupabaseProjectUrl('postgresql://postgres:secret@db.example.com/postgres'),
    ).toThrow(/http\(s\)/i)
  })
})
