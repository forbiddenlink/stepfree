import {anthropic} from '@ai-sdk/anthropic'
import {createMCPClient} from '@ai-sdk/mcp'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from 'ai'
import {z} from 'zod'
import {findStepFreeRoute} from '@/lib/graph'
import {loadNetwork, matchStation} from '@/lib/data'

export const maxDuration = 60

const ORG = 'https://api.sanity.io/v1/context/organizations/ogCe1C0tU/mcp'
// Two endpoints on purpose: an endpoint with a dataset source ignores Knowledge Base sources,
// so structured data (GROQ mode) and prose/policy (Knowledge Base mode) are served separately.
const ENDPOINTS = {
  data: process.env.SANITY_CONTEXT_GROQ_ENDPOINT ?? `${ORG}/stepfree-data`,
  guide: process.env.SANITY_CONTEXT_KB_ENDPOINT ?? `${ORG}/stepfree-guide`,
}

const INSTRUCTIONS = `You are StepFree, a guide for riders who cannot use stairs on the New York City subway.

Tools:
- stepFreeRoute: plans a route that only uses stations with ADA elevators and avoids transferring where an elevator is (or will be) out. Always use it for "how do I get from A to B".
- data_* tools (Sanity Context, GROQ mode): live structured MTA data. Use for elevator status, reliability, outages, detours at a specific station.
- guide_* tools (Sanity Context, Knowledge Base mode): MTA accessibility policy, services (Access-A-Ride, reduced fare), and the 2022 ADA settlement. Use for rights, programs, and "when will my station get an elevator".

Rules:
- Only an elevator with isAda true makes a path step-free. Escalators never do.
- If an elevator on the route is out, say so first and quote the MTA-written detour (alternativeRoute) verbatim.
- Give a confidence level (high / medium / low) based on outages and the elevators' 12-month availability.
- Never promise a route will work. End every route with: "Check mta.info/elevators before you leave."
- Say when your data was fetched. Times are New York time.
- Be brief and concrete. Riders are often on a phone, on the move.`

async function contextTools(): Promise<{tools: ToolSet; close: () => Promise<void>}> {
  const token = process.env.SANITY_CONTEXT_TOKEN
  if (!token) throw new Error('SANITY_CONTEXT_TOKEN is not set')
  const clients = await Promise.all(
    Object.entries(ENDPOINTS).map(async ([prefix, url]) => {
      try {
        const client = await createMCPClient({transport: {type: 'http', url, headers: {Authorization: `Bearer ${token}`}}})
        const tools = await client.tools()
        // Both endpoints serve `initial_context`; prefix so neither shadows the other.
        return {client, tools: Object.fromEntries(Object.entries(tools).map(([name, t]) => [`${prefix}_${name}`, t]))}
      } catch (err) {
        console.error(`Context endpoint "${prefix}" unavailable:`, err instanceof Error ? err.message : err)
        return {client: undefined, tools: {}}
      }
    }),
  )
  return {
    tools: Object.assign({}, ...clients.map((c) => c.tools)) as ToolSet,
    close: async () => {
      await Promise.all(clients.map((c) => c.client?.close()))
    },
  }
}

const stepFreeRoute = tool({
  description:
    'Plan a step-free subway route between two stations using live elevator outages. Station names can be loose ("72 st", "times sq").',
  inputSchema: z.object({
    from: z.string().describe('Origin station name'),
    to: z.string().describe('Destination station name'),
    departAt: z.string().optional().describe('ISO time the rider will travel; defaults to now'),
  }),
  execute: async ({from, to, departAt}) => {
    const {complexes, outages, fetchedAt} = await loadNetwork()
    const a = matchStation(complexes, from)
    const b = matchStation(complexes, to)
    if (!a.length || !b.length) {
      return {ok: false, reason: `No station matched "${!a.length ? from : to}".`, fetchedAt}
    }
    const at = departAt ? new Date(departAt) : new Date()
    const result = findStepFreeRoute(complexes, outages, a[0].complexId, b[0].complexId, at)
    return {
      ...result,
      from: a[0].name,
      to: b[0].name,
      otherMatches: {from: a.slice(1, 4).map((c) => c.name), to: b.slice(1, 4).map((c) => c.name)},
      travelTime: at.toISOString(),
      fetchedAt,
    }
  },
})

export async function POST(req: Request): Promise<Response> {
  const {messages}: {messages: UIMessage[]} = await req.json()
  const context = await contextTools()
  const result = streamText({
    model: anthropic('claude-sonnet-5'),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    tools: {...context.tools, stepFreeRoute},
    stopWhen: isStepCount(8),
    onFinish: context.close,
    onError: context.close,
  })
  return createUIMessageStreamResponse({stream: toUIMessageStream({stream: result.stream})})
}
