/**
 * Pure policy for dsh-workroom: classify one tool call and decide whether the
 * current autonomy level wants the user asked first. No harness imports.
 * @module dsh-workroom/lib/policy
 */

/** Autonomy levels, from hands-off to ask-every-step. */
export const LEVELS = Object.freeze(['away', 'normal', 'present'])
export const DEFAULT_LEVEL = 'normal'

/**
 * Which kinds of call each level sends to the user. `danger` is in every
 * level on purpose: no switch position can make a risky command automatic.
 */
export const ASK = Object.freeze({
  away: Object.freeze(['danger']),
  normal: Object.freeze(['install', 'danger']),
  present: Object.freeze(['write', 'run', 'install', 'git', 'danger', 'other']),
})

export const LEVEL_NAME = Object.freeze({
  away: { zh: '放手跑', en: 'Hands-off' },
  normal: { zh: '常规', en: 'Normal' },
  present: { zh: '每步确认', en: 'Ask every step' },
})

export const KIND_NAME = Object.freeze({
  read: { zh: '读取', en: 'reading' },
  write: { zh: '修改文件', en: 'changing files' },
  run: { zh: '运行命令', en: 'running a command' },
  install: { zh: '安装依赖或下载代码', en: 'installing dependencies or downloading code' },
  git: { zh: '改动本地 Git 历史', en: 'changing local Git history' },
  danger: { zh: '高风险操作', en: 'a high-risk operation' },
  other: { zh: '调用其他工具', en: 'calling another tool' },
})

/** Shell commands that always need the user, in every level. */
export const DANGER_PATTERNS = Object.freeze([
  /\bgit\s+push\b/,
  /\b(?:npm|pnpm|yarn|bun)\s+publish\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-\w*f/,
  /\bgit\s+branch\s+-D\b/,
  /\brm\s+(?:-\w+\s+)*-\w*[rR]\w*(?:\s+-\w+)*\s+(?:\/|~|\$HOME|\.\.)/,   // recursive delete of an absolute, home or parent path
  /(?:^|[\s;&|(])sudo\s/,
  /\b(?:curl|wget)\b[^|;&]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/,
  /\bchmod\s+(?:-R\s+)?0?777\b/,
  /\b(?:mkfs(?:\.\w+)?|fdisk|diskutil\s+erase\w*)\b/,
  /\bdd\s+if=/,
  /(?:^|[\s;&|])(?:shutdown|reboot|halt)(?:\s|$)/,
  /\bdocker\s+push\b/,
  /\bkubectl\s+(?:apply|delete|replace|scale|rollout|patch)\b/,
  /\bterraform\s+(?:apply|destroy)\b/,
  /\bgh\s+(?:pr\s+merge|release\s+create|repo\s+(?:delete|edit|archive))\b/,
])

/** Shell commands that install packages or download and run code. */
export const INSTALL_PATTERNS = Object.freeze([
  /\b(?:npm|pnpm|yarn|bun)\s+(?:install|i|add|ci|update|up|upgrade)\b/,
  /(?:^|[\s;&|(])(?:npx|pnpx|bunx)\s/,
  /\b(?:pnpm|yarn)\s+dlx\b/,
  /\bpip3?\s+install\b/,
  /\bpython3?\s+-m\s+pip\s+install\b/,
  /\buv\s+(?:add|pip\s+install|tool\s+install|sync)\b/,
  /\bpoetry\s+(?:add|install)\b/,
  /\bconda\s+install\b/,
  /\bcargo\s+(?:add|install)\b/,
  /\bgo\s+(?:get|install)\b/,
  /\bbrew\s+(?:install|upgrade|reinstall)\b/,
  /\bapt(?:-get)?\s+install\b/,
  /\bgem\s+install\b/,
  /\bcomposer\s+(?:require|install|update)\b/,
  /\bdotnet\s+add\b/,
])

/** Shell commands that rewrite local Git history or branches. */
export const GIT_PATTERNS = Object.freeze([
  /\bgit\s+(?:commit|merge|rebase|cherry-pick|revert|tag|stash|am)\b/,
  /\bgit\s+(?:checkout|switch)\s+-[bcB]\b/,
  /\bgit\s+branch\s+(?!-[lav]\b|--list\b)\S/,
])

export const DEFAULT_TOOLS = Object.freeze({
  shell: Object.freeze(['bash', 'pwsh', 'shell', 'powershell', 'terminal', 'run_code']),
  write: Object.freeze(['write', 'edit', 'apply_patch', 'str_replace_based_edit_tool', 'encoded_edit', 'encoded_write', 'notebook_edit']),
  read: Object.freeze(['read', 'read_image', 'glob', 'grep', 'ls', 'list', 'list_dir', 'web_search', 'web_fetch', 'encoded_read',
    'todo_read', 'todo_write', 'skill', 'working_directory', 'job_output', 'job_list', 'plugin_market']),
})

/**
 * @typedef {object} Classified
 * @property {'read'|'write'|'run'|'install'|'git'|'danger'|'other'} kind
 * @property {string} subject  short text naming what the call does (a command or a tool)
 */

/**
 * Classify one tool call.
 * @param {string} toolName
 * @param {unknown} args  the call's parsed arguments
 * @param {{ shell?: readonly string[], write?: readonly string[], read?: readonly string[], extraDanger?: readonly RegExp[] }} [tools]
 * @returns {Classified}
 */
export function classifyCall(toolName, args, tools = {}) {
  const shell = tools.shell ?? DEFAULT_TOOLS.shell
  const write = tools.write ?? DEFAULT_TOOLS.write
  const read = tools.read ?? DEFAULT_TOOLS.read
  const a = args && typeof args === 'object' ? /** @type {Record<string, unknown>} */ (args) : {}
  if (shell.includes(toolName)) {
    const command = typeof a.command === 'string' ? a.command : typeof a.code === 'string' ? a.code : ''
    return { kind: classifyCommand(command, tools.extraDanger), subject: command.trim().split('\n')[0].slice(0, 160) || toolName }
  }
  if (write.includes(toolName)) {
    const path = typeof a.file_path === 'string' ? a.file_path : typeof a.path === 'string' ? a.path : ''
    return { kind: 'write', subject: path || toolName }
  }
  if (read.includes(toolName)) return { kind: 'read', subject: toolName }
  return { kind: 'other', subject: toolName }
}

/**
 * Classify a shell command. Danger wins over install, install over git.
 * @param {string} command
 * @param {readonly RegExp[]} [extraDanger]
 * @returns {'run'|'install'|'git'|'danger'}
 */
export function classifyCommand(command, extraDanger = []) {
  const c = String(command)
  if ([...DANGER_PATTERNS, ...extraDanger].some(re => re.test(c))) return 'danger'
  if (INSTALL_PATTERNS.some(re => re.test(c))) return 'install'
  if (GIT_PATTERNS.some(re => re.test(c))) return 'git'
  return 'run'
}

/**
 * Normalise a stored level value.
 * @param {unknown} value
 * @returns {'away'|'normal'|'present'}
 */
export function normalizeLevel(value) {
  return LEVELS.includes(/** @type {string} */ (value)) ? /** @type {'away'|'normal'|'present'} */ (value) : DEFAULT_LEVEL
}

/**
 * Whether this level asks the user before a call of this kind.
 * @param {string} level
 * @param {Classified['kind']} kind
 * @returns {boolean}
 */
export function needsAsk(level, kind) {
  return ASK[normalizeLevel(level)].includes(kind)
}

/**
 * The approval reason shown to the user.
 * @param {string} level
 * @param {Classified} call
 * @returns {{ reason: string, displayReason: { en: string, zh: string } }}
 */
export function askReason(level, call) {
  const lv = LEVEL_NAME[normalizeLevel(level)], k = KIND_NAME[call.kind]
  if (call.kind === 'danger') {
    return {
      reason: `workroom: high-risk command needs approval in every level: ${call.subject}`,
      displayReason: {
        en: `Workroom: this is a high-risk operation, so it needs your approval in every level — ${call.subject}`,
        zh: `小书房：这是高风险操作，任何档位都需要你确认 —— ${call.subject}`,
      },
    }
  }
  return {
    reason: `workroom: level ${normalizeLevel(level)} asks before ${call.kind}: ${call.subject}`,
    displayReason: {
      en: `Workroom (${lv.en}): ${k.en} needs your approval — ${call.subject}`,
      zh: `小书房（${lv.zh}档）：${k.zh}需要你确认 —— ${call.subject}`,
    },
  }
}
