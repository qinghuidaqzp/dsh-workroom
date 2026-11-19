/**
 * dsh-workroom, Host half: the autonomy-level approval policy.
 *
 * Every tool call passes `tools/pre-execute`. The plugin first lets the rest of
 * the policy chain decide; only a call the chain would allow can be turned into
 * an `ask`, and only when the current level wants it. The plugin therefore never
 * allows anything dsh would otherwise stop: it can only add a confirmation.
 *
 * The level lives in this row's volatile `level` field. The Web panel changes it
 * through the settings API, so it applies to the next tool call without a reload
 * and persists in the profile like any other setting.
 * @module dsh-workroom
 */

import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_TOOLS, askReason, classifyCall, needsAsk, normalizeLevel } from './lib/policy.js'

export const name = 'workroom'
export const inject = ['tools']

export const Config = Schema.object({
  level: Schema.union(['away', 'normal', 'present']).volatile()
    .description('Autonomy level, set from the Workroom switch: away (hands-off), normal, present (ask every step).'),
  extraDangerCommands: Schema.array(Schema.string()).default([])
    .description('Extra regular expressions for shell commands that need approval in every level.'),
  shellTools: Schema.array(Schema.string()).default([...DEFAULT_TOOLS.shell])
    .description('Tools whose `command` is a shell command line.'),
  writeTools: Schema.array(Schema.string()).default([...DEFAULT_TOOLS.write])
    .description('Tools that change files.'),
  readTools: Schema.array(Schema.string()).default([...DEFAULT_TOOLS.read])
    .description('Tools that only read; never asked about.'),
})

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {any} config
 */
export function apply(ctx, config) {
  const extraDanger = config.extraDangerCommands.map(source => new RegExp(source))
  const tools = { shell: config.shellTools, write: config.writeTools, read: config.readTools, extraDanger }
  const currentLevel = () => normalizeLevel(typeof config.level?.get === 'function' ? config.level.get() : config.level)

  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (decision.kind !== 'allow') return decision          // a deny, cancel or ask from elsewhere stands
    const level = currentLevel()
    const call = classifyCall(exec.name, exec.arguments, tools)
    if (!needsAsk(level, call.kind)) return decision
    return { kind: 'ask', ...askReason(level, call) }
  })
}
