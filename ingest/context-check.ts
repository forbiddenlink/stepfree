// Go/no-go: connect to the Sanity Context MCP endpoint, list tools, and ask a question whose
// answer we already know from the public GROQ API (least reliable ADA elevator).
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const URL_ =
  process.env.SANITY_CONTEXT_GROQ_ENDPOINT ??
  'https://api.sanity.io/v1/context/organizations/ogCe1C0tU/mcp/stepfree-data'
const token = process.env.SANITY_CONTEXT_TOKEN
if (!token) {
  console.error('SANITY_CONTEXT_TOKEN missing from .env.local')
  process.exit(1)
}

const client = new Client({name: 'stepfree-check', version: '0.1.0'})
await client.connect(
  new StreamableHTTPClientTransport(new URL(URL_), {requestInit: {headers: {Authorization: `Bearer ${token}`}}}),
)
const {tools} = await client.listTools()
console.log('tools:', tools.map((t) => t.name).join(', '))

const res = await client.callTool({
  name: 'groq_query',
  arguments: {
    query:
      '*[_type=="equipment" && kind=="elevator" && isAda && defined(reliability.availability12mo)] | order(reliability.availability12mo asc)[0...3]{equipmentNo, "station": complex->name, "availability": reliability.availability12mo}',
  },
})
const text = (res.content as Array<{type: string; text?: string}>).map((c) => c.text ?? '').join('\n')
console.log(text.slice(0, 1200))
const pass = text.includes('EL290X') && text.includes('EL131')
console.log(pass ? 'GO: Context returned the known answer' : 'NO-GO: answer did not match public GROQ result')
await client.close()
process.exit(pass ? 0 : 2)
