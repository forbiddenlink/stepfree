// StepFree eval: runs every case against the live chat API and grades it with deterministic checks
// (which tool ran, what it returned, required and forbidden text). No model grades another model.
//   npx tsx eval/run.mts [baseUrl]            paced for the 8-requests-per-10-minutes chat limit
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs'

type Case = {
  id: string; cat: string; q: string; tool?: string; include?: string[]; exclude?: string[]
  ifOk?: string[]; ifNotOk?: string[]; expectOk?: boolean; expectAmbiguous?: boolean; includeWorst?: number
}
const base = process.argv[2] ?? 'https://stepfree-alpha.vercel.app'
const only = process.env.EVAL_ONLY?.split(',')
const cases = (JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as Case[]).filter((c) => !only || only.includes(c.id))
const PACE_MS = Number(process.env.EVAL_PACE_MS ?? 80_000)

async function worstElevators(n: number): Promise<string[]> {
  const q = '*[_type=="equipment" && kind=="elevator" && isAda && defined(reliability.availability12mo)] | order(reliability.availability12mo asc)[0...' + n + '].equipmentNo'
  const r = await fetch('https://19mt1buh.api.sanity.io/v2026-09-01/data/query/production?query=' + encodeURIComponent(q))
  return (await r.json()).result
}

async function ask(q: string) {
  const t0 = Date.now()
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({messages: [{id: '1', role: 'user', parts: [{type: 'text', text: q}]}]}),
  })
  const body = await res.text()
  const ms = Date.now() - t0
  const tools: Array<{name: string; input: unknown; output?: any}> = []
  const byId = new Map<string, number>()
  let text = ''
  for (const line of body.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
    let ev: any
    try { ev = JSON.parse(line.slice(6)) } catch { continue }
    if (ev.type === 'text-delta') text += ev.delta
    if (ev.type === 'tool-input-available') { byId.set(ev.toolCallId, tools.length); tools.push({name: ev.toolName, input: ev.input}) }
    if (ev.type === 'tool-output-available' && byId.has(ev.toolCallId)) tools[byId.get(ev.toolCallId)!].output = ev.output
  }
  return {status: res.status, ms, tools, text}
}

const results = []
for (const [i, c] of cases.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, PACE_MS))
  const r = await ask(c.q)
  const checks: Array<{check: string; pass: boolean}> = []
  const has = (re: string) => new RegExp(re, 'i').test(r.text)
  checks.push({check: 'http 200', pass: r.status === 200})
  const main = c.tool ? r.tools.find((t) => new RegExp(`^(${c.tool})`).test(t.name)) : undefined
  if (c.tool) checks.push({check: `called ${c.tool}`, pass: Boolean(main)})
  const out = main?.output
  if (c.expectAmbiguous) checks.push({check: 'tool returned candidates', pass: out?.ambiguous === true})
  if (c.expectOk !== undefined) checks.push({check: `tool ok=${c.expectOk}`, pass: out?.ok === c.expectOk})
  for (const re of c.include ?? []) checks.push({check: `says /${re}/`, pass: has(re)})
  for (const re of c.exclude ?? []) checks.push({check: `never says /${re}/`, pass: !has(re)})
  if (out?.ok === true) for (const re of c.ifOk ?? []) checks.push({check: `route ok: says /${re}/`, pass: has(re)})
  if (out && out.ok === false && !out.ambiguous) for (const re of c.ifNotOk ?? []) checks.push({check: `route refused: says /${re}/`, pass: has(re)})
  if (c.includeWorst) {
    const worst = await worstElevators(c.includeWorst)
    checks.push({check: `names independent worst ${worst.join(',')}`, pass: worst.every((w) => r.text.includes(w))})
  }
  const pass = checks.every((x) => x.pass)
  results.push({...c, pass, ms: r.ms, routeOk: out?.ok, tools: r.tools.map((t) => t.name), checks, text: r.text})
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.id} ${(r.ms / 1000).toFixed(1)}s ${checks.filter((x) => !x.pass).map((x) => x.check).join('; ')}`)
}

const q = (xs: number[], p: number) => xs.sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)]
const ms = results.map((r) => r.ms)
const cats = [...new Set(results.map((r) => r.cat))].map((cat) => {
  const rs = results.filter((r) => r.cat === cat)
  return {cat, passed: rs.filter((r) => r.pass).length, total: rs.length}
})
const summary = {
  base, ranAt: new Date().toISOString(),
  passed: results.filter((r) => r.pass).length, total: results.length,
  checksPassed: results.flatMap((r) => r.checks).filter((c) => c.pass).length, checksTotal: results.flatMap((r) => r.checks).length,
  latencySeconds: {p50: q([...ms], 50) / 1000, p95: q([...ms], 95) / 1000, p99: q([...ms], 99) / 1000, worst: Math.max(...ms) / 1000},
  byCategory: cats,
}
mkdirSync(new URL('./results/', import.meta.url), {recursive: true})
writeFileSync(new URL(`./results/${summary.ranAt.slice(0, 10)}.json`, import.meta.url), JSON.stringify({summary, results}, null, 2))
console.log(JSON.stringify(summary, null, 2))
