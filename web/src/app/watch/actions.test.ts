import {afterEach, describe, expect, it, vi} from 'vitest'
import {applyWatchAction} from './actions'

const {fetchWatch, patchWatch} = vi.hoisted(() => ({
  fetchWatch: vi.fn(),
  patchWatch: vi.fn(),
}))

const mockPatchBuilder = {
  set: vi.fn().mockReturnThis(),
  unset: vi.fn().mockReturnThis(),
  commit: vi.fn().mockResolvedValue({}),
}

vi.mock('@/lib/watch', () => ({
  sha256: (s: string) => `hash-${s}`,
  watchesClient: () => ({
    fetch: fetchWatch,
    patch: (id: string) => {
      patchWatch(id)
      return mockPatchBuilder
    },
  }),
}))

afterEach(() => {
  fetchWatch.mockReset()
  patchWatch.mockReset()
  mockPatchBuilder.set.mockClear()
  mockPatchBuilder.unset.mockClear()
  mockPatchBuilder.commit.mockClear()
})

describe('applyWatchAction', () => {
  it('rejects invalid action or token', async () => {
    const fd = new FormData()
    fd.set('a', 'unknown')
    fd.set('t', 'valid-token')
    const res = await applyWatchAction({done: false, message: ''}, fd)
    expect(res.done).toBe(false)
    expect(res.message).toContain('not valid')
  })

  it('rejects confirming a previously stopped watch', async () => {
    fetchWatch.mockResolvedValueOnce({_id: 'w1', status: 'stopped', createdAt: new Date().toISOString()})
    const fd = new FormData()
    fd.set('a', 'confirm')
    fd.set('t', 'token123')
    const res = await applyWatchAction({done: false, message: ''}, fd)
    expect(res.done).toBe(false)
    expect(res.message).toContain('previously stopped')
  })

  it('rejects confirming an expired watch token (> 48 hours)', async () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
    fetchWatch.mockResolvedValueOnce({_id: 'w1', status: 'pending', createdAt: threeDaysAgo})
    const fd = new FormData()
    fd.set('a', 'confirm')
    fd.set('t', 'token123')
    const res = await applyWatchAction({done: false, message: ''}, fd)
    expect(res.done).toBe(false)
    expect(res.message).toContain('expired')
  })

  it('confirms a pending watch and unsets tokenHash', async () => {
    const now = new Date().toISOString()
    fetchWatch.mockResolvedValueOnce({_id: 'w1', status: 'pending', createdAt: now})
    const fd = new FormData()
    fd.set('a', 'confirm')
    fd.set('t', 'token123')
    const res = await applyWatchAction({done: false, message: ''}, fd)
    expect(res.done).toBe(true)
    expect(patchWatch).toHaveBeenCalledWith('w1')
    expect(mockPatchBuilder.set).toHaveBeenCalledWith(expect.objectContaining({status: 'active'}))
    expect(mockPatchBuilder.unset).toHaveBeenCalledWith(['tokenHash'])
  })

  it('stops an active watch and unsets tokenHash', async () => {
    fetchWatch.mockResolvedValueOnce('w1')
    const fd = new FormData()
    fd.set('a', 'stop')
    fd.set('t', 'stopToken123')
    const res = await applyWatchAction({done: false, message: ''}, fd)
    expect(res.done).toBe(true)
    expect(patchWatch).toHaveBeenCalledWith('w1')
    expect(mockPatchBuilder.set).toHaveBeenCalledWith({status: 'stopped'})
    expect(mockPatchBuilder.unset).toHaveBeenCalledWith(['tokenHash'])
  })
})
