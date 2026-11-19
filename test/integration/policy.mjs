// Integration test against the real dsh tool pipeline. Run from a directory where @deepseek-ai/dsh is installed
// and this package sits in node_modules/dsh-workroom:  node node_modules/dsh-workroom/test/integration/policy.mjs

import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolsService, { defineTool } from '@deepseek-ai/dsh-tools'
import * as NativeExecutor from '@deepseek-ai/dsh-tool-executor-native'
import * as Workroom from '../../index.js'

async function compose(level) {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolsService); await ctx.plugin(NativeExecutor)
  const ran = []
  for (const name of ['bash', 'edit', 'read']) ctx.tools.register(defineTool({
    name, description: 'stub', parameters: { command: { type: 'string' }, file_path: { type: 'string' } },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) { ran.push(`${name}:${args.command ?? args.file_path}`); return 'ok' },
  }))
  await ctx.plugin(Workroom, level === undefined ? {} : { level })
  await new Promise(r => setTimeout(r, 30))
  let n = 0
  const call = async (name, args) => {
    const o = await ctx.tools.execute({ calls: [{ type: 'tool-call', id: `c${++n}`, name, arguments: JSON.stringify(args) }], signal: new AbortController().signal })
    const r0 = o.results?.[0] ?? o[0] ?? o, r = r0.result ?? r0
    return { error: r.isError, text: r.content.map(b => b.text).join('') }
  }
  return { ctx, call, ran }
}
const expect = {
  away:    { 'pnpm test': true, 'pnpm add zod': true,  'git commit -m x': true,  'git push': false, edit: true,  read: true },
  normal:  { 'pnpm test': true, 'pnpm add zod': false, 'git commit -m x': true,  'git push': false, edit: true,  read: true },
  present: { 'pnpm test': false, 'pnpm add zod': false, 'git commit -m x': false, 'git push': false, edit: false, read: true },
}
for (const [level, table] of Object.entries(expect)) {
  const { call, ran } = await compose(level)
  for (const [what, allowed] of Object.entries(table)) {
    const r = what === 'edit' ? await call('edit', { file_path: 'src/a.ts' }) : what === 'read' ? await call('read', { file_path: 'a.ts' }) : await call('bash', { command: what })
    assert.equal(!r.error, allowed, `${level} / ${what}: ${r.text}`)
  }
  console.log(`  ✔ ${level.padEnd(7)} ran: ${ran.join(', ')}`)
}
const d = await compose(undefined)
const r = await d.call('bash', { command: 'pnpm add zod' })
assert.equal(r.error, true)
console.log('  ✔ unset level behaves as normal; denial text:', r.text.slice(0, 160))
process.exit(0)
