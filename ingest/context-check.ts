// Go/no-go for both Sanity Context endpoints. Each asks a question whose answer we already know
// from an independent source, and the script exits non-zero if either answer does not match.
//   data  (GROQ mode):           least reliable ADA elevator == public GROQ API answer
//   guide (Knowledge Base mode): 2022 ADA settlement deadline == 2055 (settlement PDF)
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const ORG = 'https://api.sanity.io/v1/context/organizations/ogCe1C0tU/mcp'
const token = process.env.SANITY_CONTEXT_TOKEN
if (!token) {
  console.error('SANITY_CONTEXT_TOKEN missing from .env.local')
  process.exit(1)
}

type Content = Array<{type: string; text?: string}>
const textOf = (res: Record<string, unknown>): string =>
  ((res.content as Content | undefined) ?? []).map((c) => c.text ?? '').join('\n')

async function connect(name: string): Promise<Client> {
  const client = new Client({name: 'stepfree-check', version: '0.2.0'})
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${ORG}/${name}`), {requestInit: {headers: {Authorization: `Bearer ${token}`}}}),
  )
  const {tools} = await client.listTools()
  console.log(`[${name}] tools: ${tools.map((t) => t.name).join(', ')}`)
  return client
}

async function checkData(): Promise<boolean> {
  const client = await connect('stepfree-data')
  const res = await client.callTool({
    name: 'groq_query',
    arguments: {
      query:
        '*[_type=="equipment" && kind=="elevator" && isAda && defined(reliability.availability12mo)] | order(reliability.availability12mo asc)[0...3]{equipmentNo, "station": complex->name, "availability": reliability.availability12mo}',
    },
  })
  const text = textOf(res)
  await client.close()
  const pass = text.includes('EL290X') && text.includes('EL131')
  console.log(`[stepfree-data] ${pass ? 'GO' : 'NO-GO'}: least reliable ADA elevators`)
  return pass
}

async function checkGuide(): Promise<boolean> {
  const client = await connect('stepfree-guide')
  const outline = textOf(await client.callTool({name: 'initial_context', arguments: {}}))
  console.log(`[stepfree-guide] outline (first 800 chars):\n${outline.slice(0, 800)}`)
  // Find the knowledge base id and every entry path from the outline, then read the settlement ones.
  const kbId = outline.match(/kb[A-Za-z0-9]{6,}/)?.[0]
  const paths = [...outline.matchAll(/^([\w-]+(?:\/[\w-]+)*)(?: \[\w+\])?$/gm)].map((m) => m[1])
  const wanted = paths.filter((p) => /step_free|settle|right/i.test(p)).slice(0, 20)
  if (!kbId || wanted.length === 0) {
    console.log(`[stepfree-guide] NO-GO: could not find KB id (${kbId}) or entry paths in outline`)
    await client.close()
    return false
  }
  const body = textOf(await client.callTool({name: 'knowledge_base_read', arguments: {knowledgeBase: kbId, paths: wanted}}))
  await client.close()
  const pass = body.includes('2055')
  console.log(`[stepfree-guide] ${pass ? 'GO' : 'NO-GO'}: settlement deadline 2055 found in ${wanted.length} entries`)
  return pass
}

const results = await Promise.allSettled([checkData(), checkGuide()])
for (const r of results) if (r.status === 'rejected') console.error(r.reason instanceof Error ? r.reason.message : r.reason)
process.exit(results.every((r) => r.status === 'fulfilled' && r.value) ? 0 : 2)
