import {afterEach, describe, expect, it, vi} from 'vitest'

const {createMCPClient, streamText, close} = vi.hoisted(() => ({
  createMCPClient: vi.fn(),
  streamText: vi.fn(),
  close: vi.fn(async () => {}),
}))
vi.mock('@ai-sdk/mcp', () => ({createMCPClient}))
vi.mock('ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('ai')>()),
  streamText,
  createUIMessageStreamResponse: () => new Response('ok'),
  toUIMessageStream: () => new ReadableStream(),
}))

const {POST} = await import('./route')
const ask = (): Request =>
  new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({messages: [{id: '1', role: 'user', parts: [{type: 'text', text: 'When will my station get an elevator?'}]}]}),
  })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('Context endpoint failures', () => {
  it('tells the model which source is down and closes a half-open session', async () => {
    vi.stubEnv('SANITY_CONTEXT_TOKEN', 'test')
    createMCPClient.mockImplementation(async ({transport}: {transport: {url: string}}) =>
      transport.url.endsWith('stepfree-guide')
        ? {tools: async () => Promise.reject(new Error('discovery failed')), close}
        : {tools: async () => ({}), close},
    )
    streamText.mockReturnValue({stream: new ReadableStream()})

    await POST(ask())

    const {instructions} = streamText.mock.calls[0][0] as {instructions: string}
    expect(instructions).toContain('Unavailable right now: the MTA policy knowledge base')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('uses the plain instructions when both sources are up', async () => {
    vi.stubEnv('SANITY_CONTEXT_TOKEN', 'test')
    createMCPClient.mockResolvedValue({tools: async () => ({}), close})
    streamText.mockReturnValue({stream: new ReadableStream()})

    await POST(ask())

    expect((streamText.mock.calls[0][0] as {instructions: string}).instructions).not.toContain('Unavailable right now')
  })
})
