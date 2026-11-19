;(function () {
/**
 * dsh-workroom, Web half: the Workroom tab in the right sidebar.
 *
 * A 176×50 pixel room, redrawn on the CPU every frame, with a WebGL2 glass knob
 * on top. The knob position is the autonomy level the Host policy reads
 * (away · normal · present); the room shows what your sessions are doing
 * (idle · working · waiting for you · done · failed), read from the Web
 * client's session status table.
 */
/* ───────────────────────── text ───────────────────────── */
var LOCALE_NS = 'dshWorkroom'
var LOCALE = {
  zh: {
    title: '小书房', guide: '自主程度开关，看一眼就知道 Agent 在做什么',
    level: '自主', status: '状态', chime: '提示音', on: '开', off: '关',
    away: '放手跑', normal: '常规', present: '每步确认',
    awaySub: '不额外拦截，dsh 自己的沙箱和审批照常；推送等高风险命令仍要你确认',
    normalSub: '改文件、跑命令直接做；装依赖和高风险命令先问你',
    presentSub: '改文件、跑命令、装依赖、Git 提交都先问你',
    idle: '空闲', idleSub: '没有正在运行的会话',
    work: '工作中', workSub: '{n} 个会话在运行',
    ask: '等你处理', askSub: '{n} 个会话在等你确认或回答',
    done: '已完成', doneSub: '{n} 个会话有新结果',
    fail: '出错了', failSub: '{n} 个会话最近一轮以错误结束',
    risky: '推送、发布、sudo、删除工作区以外的目录等命令，在任何档位都会请你确认。',
    saving: '保存中…', saveFailed: '档位没保存上：{msg}',
    noHost: '没找到后台的 workroom 配置，开关只改界面不生效。请确认插件已安装到这个 profile。',
    chimeHint: '需要你处理或有新结果时响一声',
  },
  en: {
    title: 'Workroom', guide: 'An autonomy switch, and a room that shows what the agent is doing',
    level: 'Autonomy', status: 'Status', chime: 'Chime', on: 'on', off: 'off',
    away: 'Hands-off', normal: 'Normal', present: 'Ask every step',
    awaySub: 'No extra prompts; dsh sandbox and approvals still apply, and high-risk commands still ask you',
    normalSub: 'Edits and commands run; installs and high-risk commands ask you first',
    presentSub: 'Edits, commands, installs and Git commits all ask you first',
    idle: 'Idle', idleSub: 'No session is running',
    work: 'Working', workSub: '{n} session(s) running',
    ask: 'Needs you', askSub: '{n} session(s) waiting for your approval or answer',
    done: 'Done', doneSub: '{n} session(s) have new results',
    fail: 'Failed', failSub: '{n} session(s) ended their last turn with an error',
    risky: 'Push, publish, sudo, and deleting outside the workspace ask you in every level.',
    saving: 'Saving…', saveFailed: 'Could not save the level: {msg}',
    noHost: 'The Host workroom config was not found, so the switch has no effect. Check that the plugin is installed in this profile.',
    chimeHint: 'Chime when a session needs you or finishes',
  },
}
function lang() { const l = (document.documentElement.lang || navigator.language || 'zh').toLowerCase(); return l.startsWith('zh') ? 'zh' : 'en' }
function tr(key, vars) { let s = (LOCALE[lang()] || LOCALE.zh)[key] || LOCALE.zh[key] || key; if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]); return s }

/* ───────────────────────── styles ───────────────────────── */
var CSS = `
.dshw{--dshw-ok:#2f9e66;--dshw-warn:#d48a1c;--dshw-err:#d4483e;--dshw-accent:var(--dsw-alias-state-business-primary,#5a55d2);
  --dshw-rule:color-mix(in srgb,currentColor 14%,transparent);--dshw-muted:color-mix(in srgb,currentColor 60%,transparent);
  --shell-hi:#ffffff;--shell-lo:#e3e1ea;--shell-edge:rgba(255,255,255,.95);--shell-shade:rgba(70,60,110,.14);--shadow:rgba(72,60,118,.34);
  box-sizing:border-box;height:100%;overflow-y:auto;padding:18px 16px 16px;display:grid;gap:14px;align-content:start;font-size:13px;line-height:1.55}
.dshw *{box-sizing:border-box}
.dshw-stage{display:flex;justify-content:center;padding:8px 0 0;min-width:0}
.dshw-housing{position:relative;border-radius:999px;flex:none;cursor:grab;touch-action:none;outline:none;
  --shells:inset 0 1.5px 0 var(--shell-edge),inset 0 -2px 4px var(--shell-shade),0 1px 1px var(--shell-shade),0 22px 28px -22px var(--shadow),0 12px 16px -14px var(--shadow);
  background:linear-gradient(180deg,var(--shell-hi) 0%,var(--shell-lo) 100%);box-shadow:var(--shells),0 0 0 0 transparent;transition:box-shadow .4s;-webkit-tap-highlight-color:transparent}
.dshw-housing.dragging{cursor:grabbing}
.dshw-housing:focus-visible{outline:2px solid var(--dshw-accent);outline-offset:6px}
.dshw-housing canvas{position:absolute;inset:0;display:block;width:100%;height:100%;border-radius:999px;pointer-events:none}
.dshw-housing[data-mode="ask"]{animation:dshwAsk 1.1s ease-in-out infinite}
.dshw-housing[data-mode="done"]{box-shadow:var(--shells),0 0 0 3px color-mix(in srgb,var(--dshw-ok) 55%,transparent)}
.dshw-housing[data-mode="error"]{box-shadow:var(--shells),0 0 0 3px color-mix(in srgb,var(--dshw-err) 55%,transparent)}
@keyframes dshwAsk{0%,100%{box-shadow:var(--shells),0 0 0 1px color-mix(in srgb,var(--dshw-warn) 35%,transparent)}50%{box-shadow:var(--shells),0 0 0 5px color-mix(in srgb,var(--dshw-warn) 70%,transparent)}}
.dshw-levels{position:relative;height:26px;margin:0 auto;color:var(--dshw-muted);font-size:12px}
.dshw-levels button{position:absolute;top:0;transform:translateX(-50%);padding:8px 2px 0;white-space:nowrap;background:none;border:0;color:inherit;font:inherit;cursor:pointer}
.dshw-levels button::before{content:"";position:absolute;left:50%;top:0;width:1px;height:5px;background:var(--dshw-rule)}
.dshw-levels button:first-child{transform:translateX(-30%)}
.dshw-levels button:last-child{transform:translateX(-70%)}
.dshw-levels button.on{color:inherit;font-weight:600}
.dshw-levels button:focus-visible{outline:2px solid var(--dshw-accent);outline-offset:2px;border-radius:4px}
.dshw-reads{margin:0;display:grid;border-top:1px solid var(--dshw-rule)}
.dshw-reads>div{display:grid;grid-template-columns:52px minmax(0,1fr);gap:10px;padding:10px 2px;border-bottom:1px solid var(--dshw-rule);align-items:baseline}
.dshw-reads dt{font-size:11.5px;color:var(--dshw-muted)}
.dshw-reads dd{margin:0;display:grid;gap:1px;min-width:0}
.dshw-big{font-size:16px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.dshw-sub{font-size:12px;color:var(--dshw-muted);overflow-wrap:anywhere}
.dshw-big[data-mode="ask"]{color:var(--dshw-warn)}
.dshw-big[data-mode="done"]{color:var(--dshw-ok)}
.dshw-big[data-mode="error"]{color:var(--dshw-err)}
.dshw-foot{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.dshw-chime{font:inherit;font-size:12.5px;color:inherit;background:transparent;border:1px solid var(--dshw-rule);border-radius:999px;padding:6px 12px;cursor:pointer}
.dshw-chime:focus-visible{outline:2px solid var(--dshw-accent);outline-offset:2px}
.dshw-note{margin:0;font-size:12px;color:var(--dshw-muted)}
.dshw-warn{margin:0;font-size:12px;color:var(--dshw-err)}
@media (prefers-reduced-motion:reduce){.dshw-housing[data-mode="ask"]{animation:none;box-shadow:var(--shells),0 0 0 4px color-mix(in srgb,var(--dshw-warn) 65%,transparent)}}
`

/* ───────────────────────── the panel ───────────────────────── */
function mountWorkroom(root, services, t) {
  const say = (key, vars) => { let s = typeof t === 'function' ? t(key) : tr(key); if (!s || s === key) s = tr(key); if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]); return s }
  const LEVELS = ['away', 'normal', 'present']
  const DETENTS = [0, 0.5, 1]
  const levelIndex = x => x < 0.25 ? 0 : x < 0.75 ? 1 : 2
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v
  const mix = (a, b, k) => a + (b - a) * k
  const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x) }
  const mixc = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)]
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
  const stops = (list, k) => { if (k <= list[0][0]) return list[0][1]; for (let i = 1; i < list.length; i++) if (k <= list[i][0]) return mixc(list[i - 1][1], list[i][1], sstep(list[i - 1][0], list[i][0], k)); return list[list.length - 1][1] }
  const hash = (x, y) => { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const disposers = []

  /* DOM */
  root.innerHTML = `
    <div class="dshw-stage"><div class="dshw-housing" role="slider" tabindex="0" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="2" aria-valuenow="1"><canvas aria-hidden="true"></canvas></div></div>
    <div class="dshw-levels"></div>
    <dl class="dshw-reads">
      <div><dt></dt><dd><span class="dshw-big" data-r="level"></span><span class="dshw-sub" data-r="level-sub"></span></dd></div>
      <div><dt></dt><dd><span class="dshw-big" data-r="state" data-mode="idle"></span><span class="dshw-sub" data-r="state-sub"></span></dd></div>
    </dl>
    <p class="dshw-warn" data-r="warn" hidden></p>
    <div class="dshw-foot"><button class="dshw-chime" type="button" aria-pressed="false"></button><p class="dshw-note" data-r="chime-note"></p></div>
    <p class="dshw-note" data-r="risky"></p>`
  const $ = sel => root.querySelector(sel)
  const housing = $('.dshw-housing'), canvas = $('canvas'), levelsEl = $('.dshw-levels'), stage = $('.dshw-stage')
  const dts = root.querySelectorAll('dt'); dts[0].textContent = say('level'); dts[1].textContent = say('status')
  housing.setAttribute('aria-label', `${say('title')}: ${say('level')}`)
  $('[data-r="risky"]').textContent = say('risky')
  $('[data-r="chime-note"]').textContent = say('chimeHint')
  LEVELS.forEach((lv, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = say(lv); b.addEventListener('click', () => setTarget(DETENTS[i], true)); levelsEl.append(b) })

  /* ── agent state from the session status table ── */
  const agent = { mode: 'idle', since: performance.now() / 1000 }
  function readStatus() {
    let running = 0, pending = 0, unread = 0, failed = 0
    let snap
    try { snap = services.getStatus()?.getSnapshot() } catch { snap = undefined }
    if (snap && typeof snap.forEach === 'function') snap.forEach(s => {
      if (!s) return
      if (s.pendingInteraction) pending++
      else if (s.running) running++
      if (s.completionFailed) failed++
      else if (s.completionUnread) unread++
    })
    const mode = pending ? 'ask' : running ? 'think' : failed ? 'error' : unread ? 'done' : 'idle'
    const n = { ask: pending, think: running, error: failed, done: unread, idle: 0 }[mode]
    setMode(mode, n)
  }
  const MODE_KEY = { idle: 'idle', think: 'work', ask: 'ask', done: 'done', error: 'fail' }
  function setMode(mode, n) {
    const changed = mode !== agent.mode
    if (changed) { agent.mode = mode; agent.since = performance.now() / 1000 }
    const key = MODE_KEY[mode], big = $('[data-r="state"]')
    big.textContent = say(key); big.dataset.mode = mode === 'think' ? 'work' : mode
    $('[data-r="state-sub"]').textContent = say(`${key}Sub`, { n })
    housing.dataset.mode = mode
    if (changed && (mode === 'ask' || mode === 'done' || mode === 'error')) chime[mode]()
  }
  let subscribedTo = null
  function trySubscribe() {   // the status table may arrive after the tab mounts; re-check from the frame loop
    const s = services.getStatus()
    if (!s || s === subscribedTo) return
    try {
      const unsub = s.subscribe(readStatus)
      if (typeof unsub === 'function') disposers.push(unsub)
      subscribedTo = s; readStatus()
    } catch (err) { console.warn('[dsh-workroom] session status unavailable', err) }
  }
  trySubscribe()

  /* ── level: stored in the Host row's volatile config ── */
  const NS = 'workroom'
  let hostFound = true, saving = false, revision
  async function loadLevel() {
    try {
      const r = await services.settings.describe()
      if (!r.ok) throw new Error(r.error?.message || 'describe failed')
      const view = (r.value.namespaces || []).find(v => v.ns === NS)
      hostFound = !!view
      revision = view?.revision
      warn(hostFound ? '' : say('noHost'))
      const lv = view?.value?.level
      const idx = LEVELS.indexOf(LEVELS.includes(lv) ? lv : 'normal')
      if (!saving) { st.target = DETENTS[idx]; if (!st.dragging && !st.loaded) { st.x = st.target; st.v = 0 } }
      st.loaded = true
    } catch (err) { warn(say('saveFailed', { msg: err.message })) }
  }
  async function saveLevel(idx) {
    if (!hostFound) { warn(say('noHost')); return }
    saving = true
    try {
      // The settings API takes the revision last read, so a stale write is refused instead of overwriting.
      let r = await services.settings.update(NS, { level: LEVELS[idx] }, revision)
      if (!r.ok) {   // another window changed the config meanwhile: re-read once and retry
        saving = false; await loadLevel(); saving = true
        r = await services.settings.update(NS, { level: LEVELS[idx] }, revision)
      }
      if (!r.ok) warn(say('saveFailed', { msg: r.error?.message || '' }))
      else warn('')
    } catch (err) { warn(say('saveFailed', { msg: err.message })) }
    saving = false
    st.target = DETENTS[idx]
    loadLevel()   // pick up the new revision
  }
  function warn(text) { const w = $('[data-r="warn"]'); w.textContent = text; w.hidden = !text }
  try { const off = services.onSettingsChanged(ns => { if (ns === NS && !saving) loadLevel() }); if (typeof off === 'function') disposers.push(off) } catch { /* optional */ }

  /* ── chime ── */
  let soundOn = false
  try { soundOn = localStorage.getItem('dsh-workroom:chime') === '1' } catch { /* storage blocked */ }
  let ac = null
  const note = (f, at, dur, g, type = 'sine') => { const o = ac.createOscillator(), gg = ac.createGain(); o.type = type; o.frequency.value = f; gg.gain.setValueAtTime(0, at); gg.gain.linearRampToValueAtTime(g, at + 0.01); gg.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(gg).connect(ac.destination); o.start(at); o.stop(at + dur + 0.05) }
  const ensureAudio = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state !== 'running') ac.resume() }
  const chime = {
    ask() { if (!soundOn || !ac) return; const t0 = ac.currentTime + 0.02; note(659.25, t0, 0.5, 0.16); note(987.77, t0 + 0.16, 0.7, 0.14) },
    done() { if (!soundOn || !ac) return; const t0 = ac.currentTime + 0.02; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, t0 + i * 0.11, 0.9, 0.11, 'triangle')) },
    error() { if (!soundOn || !ac) return; const t0 = ac.currentTime + 0.02; note(392, t0, 0.5, 0.14, 'triangle'); note(311.13, t0 + 0.2, 0.7, 0.14, 'triangle') },
    tick() { if (!soundOn || !ac) return; note(2200, ac.currentTime, 0.03, 0.035, 'square') },
  }
  const chimeBtn = $('.dshw-chime')
  const paintChime = () => { chimeBtn.textContent = `${say('chime')}：${soundOn ? say('on') : say('off')}`; chimeBtn.setAttribute('aria-pressed', String(soundOn)) }
  chimeBtn.addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('dsh-workroom:chime', soundOn ? '1' : '0') } catch { /* ignore */ } if (soundOn) { ensureAudio(); chime.done() } paintChime() })
  paintChime()

  /* ── the room ── */
  const W = 176, H = 50, N = W * H
  const alb = new Float32Array(N * 3), emi = new Float32Array(N * 3), post = new Float32Array(N * 3), isE = new Uint8Array(N)
  const bufNow = new Uint8ClampedArray(N * 4), bufDay = new Uint8ClampedArray(N * 4)
  const A = (x, y, c, k = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; alb[i * 3] = c[0] * k; alb[i * 3 + 1] = c[1] * k; alb[i * 3 + 2] = c[2] * k; isE[i] = 0 }
  const E = (x, y, c) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; emi[i * 3] = c[0]; emi[i * 3 + 1] = c[1]; emi[i * 3 + 2] = c[2]; isE[i] = 1 }
  const addE = (x, y, c, a) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; emi[i * 3] += c[0] * a; emi[i * 3 + 1] += c[1] * a; emi[i * 3 + 2] += c[2] * a }
  const P = (x, y, c, a) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; post[i * 3] += c[0] * a; post[i * 3 + 1] += c[1] * a; post[i * 3 + 2] += c[2] * a }
  const shadeA = (x, y, k) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (isE[i]) return; alb[i * 3] *= k; alb[i * 3 + 1] *= k; alb[i * 3 + 2] *= k }
  const rectA = (x0, y0, w, h, c, k = 1) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) A(x, y, c, k) }
  let seed = 62
  const R = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let q = Math.imul(seed ^ seed >>> 15, 1 | seed); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296 }
  const GLASS = { x0: 20, x1: 56, y0: 7, y1: 29 }, MULL_X = 38, MULL_Y = 18
  const stars = Array.from({ length: 16 }, () => ({ x: GLASS.x0 + Math.floor(R() * 37), y: GLASS.y0 + Math.floor(R() * 13), p: R() * 6.28, s: 0.6 + R() * 1.8, b: 0.5 + R() * 0.5 }))
  const skyline = []
  for (let x = GLASS.x0; x <= GLASS.x1;) { const w = 3 + Math.floor(R() * 4), h = 3 + Math.floor(R() * 7), wins = []; for (let wy = 0; wy < h - 1; wy += 2) for (let wx = 1; wx < w - 1; wx += 2) if (R() < 0.45) wins.push([wx, wy + 1, R() * 40]); skyline.push({ x, w, h, ant: R() < 0.25, wins }); x += w + (R() < 0.3 ? 1 : 0) }
  const codeLines = [[[0, 5, 0], [6, 4, 1], [11, 3, 2]], [[2, 3, 3], [6, 7, 0]], [[2, 2, 1], [5, 5, 2], [11, 3, 0]], [[4, 6, 3], [11, 2, 1]], [[0, 2, 0], [3, 9, 2], [13, 4, 3]]]
  const codeCols = [hex('#8fb6ff'), hex('#d79bf2'), hex('#8de0b0'), hex('#f2cf7c')]
  const books = [[2, 6, '#b5585a'], [3, 5, '#4f72b0'], [2, 7, '#d9b25a'], [2, 5, '#5f9a73'], [3, 6, '#8a66a8'], [2, 4, '#c98a5a']]
  const leaves = [[-0.15, 13], [0.38, 11], [-0.62, 9], [0.82, 8], [0.08, 15], [-0.9, 6], [0.6, 12]]
  const C = {
    wall: hex('#e4dcef'), base: hex('#f3f1f7'), baseLine: hex('#857b97'), wood: hex('#c29470'), frame: hex('#f5f3f9'), frameIn: hex('#cfc8dc'),
    curtain: hex('#c89aa6'), curtainDk: hex('#a77b88'), rod: hex('#4a4352'), clockFace: hex('#fbf3dc'), clockRim: hex('#5a5163'), hand: hex('#2f2a38'),
    shelf: hex('#a37a5c'), desk: hex('#9e7356'), deskDk: hex('#7c5843'), drawer: hex('#946b50'), handle: hex('#e8dcc4'), bezel: hex('#1d1d24'),
    stand: hex('#34343c'), keys: hex('#d4d3dc'), keysDk: hex('#a9a8b4'), lampBase: hex('#3a3a43'), shade: hex('#e0645a'), shadeIn: hex('#f4e7d0'),
    mug: hex('#f2f0f6'), mugBand: hex('#7fb0d9'), pot: hex('#c8724f'), potRim: hex('#dc8a63'), soil: hex('#4a3428'), leaf: hex('#4f9a5c'), leafDk: hex('#377a48'),
    rug: hex('#9d92c9'), rugEdge: hex('#7a6fa8'), cat: hex('#6e6b78'), catDk: hex('#56535f'), catEye: hex('#e9cf6a'), sign: hex('#2a2731'),
  }
  const AMB = [[0, hex('#272a55')], [0.45, hex('#6a6898')], [0.75, hex('#d4cbe0')], [1, hex('#f5f2f6')]]
  const SKY_TOP = [[0, hex('#070a1f')], [0.45, hex('#1c2459')], [0.72, hex('#5f86d4')], [1, hex('#8fc0f2')]]
  const SKY_BOT = [[0, hex('#141a3f')], [0.45, hex('#e58f86')], [0.72, hex('#ffc596')], [1, hex('#fde8cf')]]
  const CITY = [[0, hex('#090b1c')], [0.5, hex('#2b2742')], [1, hex('#a4aacb')]]
  const GLYPH_Q = ['01110', '10001', '00010', '00100', '00000', '00100']
  const GLYPH_OK = ['000001', '000010', '100100', '010100', '001000']
  const GLYPH_X = ['10001', '01010', '00100', '01010', '10001']

  function drawMonitor(k, time) {
    const sb = mix(1, 0.7, k), m = agent.mode, age = time - agent.since
    let bg = mixc(hex('#132654'), hex('#26324a'), k)
    if (m === 'idle') bg = mixc(hex('#0b1020'), hex('#1b2232'), k)
    if (m === 'ask') bg = hex('#241a08')
    if (m === 'done') bg = hex('#0d2116')
    if (m === 'error') bg = hex('#2a0e0e')
    for (let y = 15; y <= 25; y++) for (let x = 104; x <= 125; x++) E(x, y, [bg[0] * sb + 0.02, bg[1] * sb + 0.02, bg[2] * sb + 0.03])
    const glyph = (rows, x0, y0, c, a) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '1') addE(x0 + i, y0 + j, c, a) }))
    if (m === 'idle') { addE(105 + Math.floor((Math.sin(time * 0.37) * 0.5 + 0.5) * 19), 16 + Math.floor((Math.sin(time * 0.53 + 1) * 0.5 + 0.5) * 8), [0.5, 0.6, 1], 0.6 * sb) }
    else if (m === 'think') {
      const typed = Math.floor((age * 9) % 60); let n = 0
      codeLines.forEach((segs, li) => { const y = 16 + li * 2; for (const [x0, len, ci] of segs) for (let q = 0; q < len; q++) { n++; if (n > typed) return; if (105 + x0 + q <= 124) addE(105 + x0 + q, y, codeCols[ci], 0.85 * sb) } })
    } else if (m === 'ask') glyph(GLYPH_Q, 112, 17, [1, 0.72, 0.25], 0.55 + 0.45 * Math.sin(time * 6))
    else if (m === 'done') glyph(GLYPH_OK, 112, 18, [0.4, 1, 0.6], 1)
    else if (m === 'error') glyph(GLYPH_X, 112, 18, [1, 0.4, 0.35], 1)
    rectA(107, 7, 15, 6, C.sign)
    let sc = null, sa = 0
    if (m === 'ask') { sc = [1, 0.66, 0.15]; sa = Math.sin(time * 7) > 0 ? 1 : 0.25 }
    else if (m === 'done') { sc = [0.35, 1, 0.55]; sa = 1 }
    else if (m === 'error') { sc = [1, 0.3, 0.25]; sa = 1 }
    else if (m === 'think') { sc = [0.45, 0.6, 1]; sa = 0.55 + 0.25 * Math.sin(time * 2.5) }
    if (sc) {
      for (let y = 8; y <= 11; y++) for (let x = 108; x <= 120; x++) E(x, y, [sc[0] * sa, sc[1] * sa, sc[2] * sa])
      const reach = m === 'think' ? 14 : 40
      for (let y = 0; y < 40; y++) for (let x = 80; x <= 150; x++) { const d2 = (x - 114) ** 2 + ((y - 9.5) * 1.4) ** 2; P(x, y, sc, sa * 0.3 / (1 + d2 / reach)) }
    }
  }

  function drawScene(out, k, time) {
    alb.fill(0); emi.fill(0); post.fill(0); isE.fill(0)
    const lampOn = 1 - sstep(0.5, 0.78, k), sunA = sstep(0.55, 0.85, k), beamA = sstep(0.62, 0.95, k), moonA = 1 - sstep(0.35, 0.62, k), nightA = 1 - sstep(0.3, 0.62, k)
    for (let y = 0; y < 37; y++) for (let x = 0; x < W; x++) { let q = (x % 9 === 0) ? 0.965 : 1; if (y < 2) q *= 0.88; else if (y > 32) q *= 0.97; A(x, y, C.wall, q * (0.985 + hash(x, y) * 0.03)) }
    for (let x = 0; x < W; x++) { A(x, 37, C.base); A(x, 38, C.baseLine) }
    for (let y = 39; y < H; y++) { const plank = Math.floor((y - 39) / 3); for (let x = 0; x < W; x++) { let q = (plank % 2 ? 1.05 : 0.97) * (0.95 + hash(x >> 2, y) * 0.08); if ((y - 39) % 3 === 2) q *= 0.84; if ((x + plank * 13) % 26 === 0) q *= 0.8; A(x, y, C.wood, q) } }
    for (let x = 12; x <= 66; x++) A(x, 3, C.rod)
    for (const [cx0, cx1] of [[12, 17], [59, 64]]) for (let y = 4; y <= 35; y++) for (let x = cx0; x <= cx1; x++) A(x, y, (x + (y > 30 ? 1 : 0)) % 2 ? C.curtain : C.curtainDk, y > 31 ? 0.94 : 1)
    rectA(18, 5, 41, 27, C.frame)
    const top = stops(SKY_TOP, k), bot = stops(SKY_BOT, k), sunY = mix(31, 11, sstep(0.55, 1, k)), sunX = 47
    for (let y = GLASS.y0; y <= GLASS.y1; y++) { const j = (y - GLASS.y0) / (GLASS.y1 - GLASS.y0), sky = mixc(top, bot, Math.pow(j, 1.35)); for (let x = GLASS.x0; x <= GLASS.x1; x++) { const glow = sunA * 0.55 / (1 + ((x - sunX) ** 2 + (y - sunY) ** 2) / 22), sheen = ((x - y * 0.8 + 40) % 13) < 1.3 ? 0.035 : 0; E(x, y, [sky[0] + glow + sheen, sky[1] + 0.62 * glow + sheen, sky[2] + 0.35 * glow + sheen]) } }
    for (const s of stars) { const b = nightA * s.b * (0.55 + 0.45 * Math.sin(time * s.s + s.p)); if (b > 0.02) addE(s.x, s.y, [0.95, 0.95, 1], b) }
    if (moonA > 0.01) { const mx = 27, my = 10 + 9 * sstep(0, 0.62, k); for (let y = my - 3; y <= my + 3; y++) for (let x = mx - 3; x <= mx + 3; x++) { if (Math.hypot(x - mx, y - my) <= 2.6 && !(Math.hypot(x - mx - 1.4, y - my + 0.9) <= 2.4) && x >= GLASS.x0 && y >= GLASS.y0 && y <= GLASS.y1) addE(x, y, [0.92, 0.93, 1], moonA) } }
    if (sunA > 0.01) for (let y = Math.floor(sunY - 3); y <= sunY + 3; y++) for (let x = sunX - 3; x <= sunX + 3; x++) if (Math.hypot(x - sunX, y - sunY) <= 2.6 && y >= GLASS.y0 && y <= GLASS.y1) E(x, y, mixc([1, 0.72, 0.5], [1, 0.97, 0.86], sstep(0.55, 0.9, k)))
    const city = stops(CITY, k)
    for (const b of skyline) { const topY = GLASS.y1 - b.h + 1; for (let y = topY; y <= GLASS.y1; y++) for (let x = b.x; x < b.x + b.w && x <= GLASS.x1; x++) E(x, y, city); if (b.ant) E(b.x + 1, topY - 1, city); for (const [wx, wy, ph] of b.wins) { const a = nightA * (Math.sin(time * 0.07 + ph) > -0.6 ? 1 : 0); if (a > 0 && b.x + wx <= GLASS.x1) addE(b.x + wx, topY + wy, [1, 0.78, 0.42], a * 0.9) } }
    for (let y = GLASS.y0; y <= GLASS.y1; y++) A(MULL_X, y, C.frame)
    for (let x = GLASS.x0; x <= GLASS.x1; x++) { A(x, MULL_Y, C.frame); A(x, 6, C.frameIn) }
    for (let x = 16; x <= 60; x++) { A(x, 31, C.frame); A(x, 32, C.frame, 0.9); shadeA(x, 33, 0.82) }
    const now = new Date(), minutes = now.getHours() * 60 + now.getMinutes(), ccx = 70, ccy = 12, cr = 5.2
    for (let y = 6; y <= 18; y++) for (let x = 64; x <= 76; x++) { const d = Math.hypot(x - ccx, y - ccy); if (d <= cr) A(x, y, d > cr - 1.1 ? C.clockRim : C.clockFace) }
    const hand = (ang, len) => { for (let s = 0; s <= len; s += 0.5) A(Math.round(ccx + Math.sin(ang) * s), Math.round(ccy - Math.cos(ang) * s), C.hand) }
    hand((minutes % 60) / 60 * 6.283, 3.6); hand(((minutes / 60) % 12) / 12 * 6.283, 2.3)
    rectA(126, 10, 26, 2, C.shelf)
    let bx = 128; for (const [w, h, col] of books) { rectA(bx, 10 - h, w, h, hex(col)); bx += w }
    rectA(94, 28, 54, 1, C.desk); rectA(94, 29, 54, 1, C.deskDk); rectA(96, 30, 2, 8, C.deskDk); rectA(144, 30, 2, 8, C.deskDk)
    rectA(124, 30, 19, 7, C.drawer); for (let x = 124; x < 143; x++) A(x, 33, C.drawer, 0.82); rectA(131, 31, 4, 1, C.handle); rectA(131, 35, 4, 1, C.handle)
    for (let x = 98; x < 147; x++) for (let y = 39; y <= 40; y++) shadeA(x, y, 0.86)
    for (let x = 102; x <= 118; x++) A(x, 27, (x % 2) ? C.keys : C.keysDk)
    rectA(103, 14, 24, 13, C.bezel); rectA(113, 26, 3, 1, C.stand); rectA(110, 27, 9, 1, C.stand)
    drawMonitor(k, time)
    rectA(137, 27, 5, 1, C.lampBase)
    for (const [x, y] of [[139, 26], [139, 25], [138, 24], [138, 23], [137, 22], [137, 21], [136, 20]]) A(x, y, C.lampBase)
    for (let x = 133; x <= 136; x++) A(x, 16, C.shade); for (let x = 132; x <= 137; x++) A(x, 17, C.shade, 0.95); for (let x = 131; x <= 138; x++) A(x, 18, C.shade, 0.88)
    for (let x = 132; x <= 137; x++) { if (lampOn > 0.04 && x >= 133 && x <= 136) E(x, 19, mixc(C.shadeIn, [1.6, 1.25, 0.8], lampOn)); else A(x, 19, C.shadeIn, 0.9) }
    rectA(141, 24, 4, 4, C.mug); rectA(141, 25, 4, 1, C.mugBand); A(145, 25, C.mug); A(145, 26, C.mug)
    const steamA = agent.mode === 'done' ? 1 : 0.35 + 0.65 * sstep(0.55, 1, k)
    for (let w = 0; w < 2; w++) for (let q = 0; q < 7; q++) P(Math.round(142 + w + Math.sin(time * 1.7 + q * 0.8 + w * 2.1) * 0.9), 22 - q, [1, 1, 1], steamA * (1 - q / 7) * 0.22)
    for (let y = 42; y <= 48; y++) for (let x = 46; x <= 114; x++) { const nx = (x - 80) / 33, ny = (y - 45.2) / 3.6, r2 = nx * nx + ny * ny; if (r2 <= 1) A(x, y, r2 > 0.62 ? C.rugEdge : C.rug) }
    if (agent.mode === 'ask' || agent.mode === 'done' || agent.mode === 'error') {
      for (let y = 35; y <= 46; y++) for (let x = 68; x <= 82; x++) { if (((x - 75) / 3.8) ** 2 + ((y - 42.5) / 3.6) ** 2 <= 1) A(x, y, (x % 3 === 0 && y < 43) ? C.catDk : C.cat, y > 44 ? 0.9 : 1); if (Math.hypot(x - 75, y - 37.4) <= 2.3) A(x, y, C.cat, 1.04) }
      A(73, 35, C.cat); A(77, 35, C.cat); A(73, 34, C.cat); A(77, 34, C.cat)
      const blink = Math.sin(time * 1.3) > 0.96
      A(74, 37, blink ? C.catDk : C.catEye); A(76, 37, blink ? C.catDk : C.catEye)
      for (let q = 0; q < 5; q++) A(79 + Math.round(Math.sin(time * 2 + q * 0.6) * (agent.mode === 'ask' ? 1 : 0.3)), 45 - q, C.catDk)
    } else {
      const breathe = 0.28 * Math.sin(time * 1.7)
      for (let y = 39; y <= 46; y++) for (let x = 66; x <= 86; x++) { const nx = (x - 77) / 6.6, ny = (y - 43.4) / (2.5 + breathe); if (nx * nx + ny * ny <= 1) A(x, y, (x % 3 === 0 && y < 44) ? C.catDk : C.cat, y > 44 ? 0.9 : 1); if (Math.hypot(x - 70.6, y - 42.4) <= 2.2) A(x, y, C.cat, 1.04) }
      A(69, 40, C.cat); A(72, 40, C.cat); for (let x = 73; x <= 84; x++) A(x, 46, C.catDk); A(69, 42, C.catDk); A(71, 42, C.catDk)
    }
    for (let x = 67; x <= 87; x++) shadeA(x, 47, 0.8)
    for (let x = 149; x <= 159; x++) A(x, 40, C.potRim)
    for (let y = 41; y <= 47; y++) { const inset = Math.floor((y - 41) / 3); for (let x = 150 + inset; x <= 158 - inset; x++) A(x, y, C.pot, x === 158 - inset ? 0.82 : 1) }
    for (let x = 150; x <= 158; x++) A(x, 40, C.soil); for (let x = 149; x <= 162; x++) shadeA(x, 48, 0.78)
    leaves.forEach(([ang, len], i) => { const a = ang + (reduceMotion ? 0 : 0.05 * Math.sin(time * 0.9 + i * 1.3)), dx = Math.sin(a), dy = -Math.cos(a); for (let s = 0; s <= len; s += 0.5) { const cx = 154 + dx * s, cy = 40 + dy * s, w = s > len * 0.25 ? Math.sin(Math.PI * (s - len * 0.25) / (len * 0.75)) * 2.1 : 0.3; for (let o = -w; o <= w; o += 0.5) A(Math.round(cx - dy * o), Math.round(cy + dx * o), Math.abs(o) < 0.6 ? C.leafDk : C.leaf) } })
    const amb = stops(AMB, k), k2 = 2.0, scr = agent.mode === 'idle' ? 0.35 : 1
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let r, g, b
      if (isE[i]) { r = emi[i * 3]; g = emi[i * 3 + 1]; b = emi[i * 3 + 2] }
      else {
        let lr = amb[0], lg = amb[1], lb = amb[2]
        if (lampOn > 0.001) { const dx = x - 134.5, dy = y - 20, d2 = dx * dx + dy * dy * 1.2; let l = 0.5 / (1 + d2 / 70); if (dy > 0) l += sstep(0.5, 0.9, dy / Math.sqrt(d2 + 0.01)) * 2.4 / (1 + d2 / 260); l *= lampOn; lr += l; lg += 0.68 * l; lb += 0.38 * l }
        { const dx = x - 114.5, dy = y - 20.5, l = scr * mix(0.95, 0.12, k) / (1 + (dx * dx + dy * dy) / 110); lr += 0.32 * l; lg += 0.48 * l; lb += 0.95 * l }
        { const dx = x - 38, dy = y - 18, l = sstep(0.45, 1, k) * 0.32 / (1 + (dx * dx + dy * dy) / 1300); lr += l; lg += l * 0.93; lb += l * 0.86 }
        if (y >= 39) { const m = y - 31
          if (moonA > 0.01) { const xa = 20 + m * 1.4, xb = 56 + m * 1.4; if (x >= xa && x <= xb && Math.abs(x - (MULL_X + m * 1.4)) > 1) { lr += 0.12 * moonA; lg += 0.15 * moonA; lb += 0.32 * moonA } }
          if (beamA > 0.01) { const xa = 20 + m * k2, xb = 56 + m * k2; if (x >= xa && x <= xb && Math.abs(x - (MULL_X + m * k2)) > 1.2 && y !== 43) { lr += 0.95 * beamA; lg += 0.78 * beamA; lb += 0.55 * beamA } } }
        r = alb[i * 3] * lr; g = alb[i * 3 + 1] * lg; b = alb[i * 3 + 2] * lb
      }
      r += post[i * 3]; g += post[i * 3 + 1]; b += post[i * 3 + 2]
      out[i * 4] = r * 255; out[i * 4 + 1] = g * 255; out[i * 4 + 2] = b * 255; out[i * 4 + 3] = 255
    }
    if (lampOn > 0.01) for (let y = 14; y <= 26; y++) for (let x = 127; x <= 142; x++) { const a = lampOn * 0.5 / (1 + ((x - 134.5) ** 2 + (y - 19.5) ** 2) / 5), i = (y * W + x) * 4; out[i] += 255 * a; out[i + 1] += 190 * a; out[i + 2] += 110 * a }
  }

  /* ── housing colours follow the level ── */
  let lastK = -1
  const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`
  function applyHousing(k) {
    if (Math.abs(k - lastK) < 0.002) return; lastK = k
    const e = sstep(0.2, 0.85, k), s = root.style
    s.setProperty('--shell-hi', css(mixc(hex('#4a4c58'), hex('#ffffff'), e)))
    s.setProperty('--shell-lo', css(mixc(hex('#1d1e25'), hex('#e3e1ea'), e)))
    s.setProperty('--shell-edge', `rgba(255,255,255,${mix(0.12, 0.95, e).toFixed(3)})`)
    s.setProperty('--shell-shade', `rgba(${Math.round(mix(0, 70, e))},${Math.round(mix(0, 60, e))},${Math.round(mix(0, 110, e))},${mix(0.35, 0.14, e).toFixed(3)})`)
    s.setProperty('--shadow', `rgba(${Math.round(mix(2, 72, e))},${Math.round(mix(3, 60, e))},${Math.round(mix(20, 118, e))},${mix(0.6, 0.34, e).toFixed(3)})`)
  }

  /* ── sizing ── */
  const geo = { s: 1, dpr: 1, cw: 0, ch: 0, tx: 0, ty: 0, tw: 0, th: 0, r: 0, halfH: 0, x0: 0, x1: 0 }
  function layout() {
    const dpr = Math.max(1, window.devicePixelRatio || 1), avail = Math.min(Math.max(stage.clientWidth, 120), 560)
    const s = Math.max(1, Math.floor(avail * dpr / 192)), bez = 8 * s
    Object.assign(geo, { s, dpr, tw: W * s, th: H * s, tx: bez, ty: bez })
    geo.cw = geo.tw + 2 * bez; geo.ch = geo.th + 2 * bez; geo.r = 0.34 * geo.th; geo.halfH = 0.58 * geo.th
    geo.x0 = geo.tx + geo.th / 2; geo.x1 = geo.tx + geo.tw - geo.th / 2
    canvas.width = geo.cw; canvas.height = geo.ch
    housing.style.width = `${geo.cw / dpr}px`; housing.style.height = `${geo.ch / dpr}px`
    levelsEl.style.width = `${geo.cw / dpr}px`
    ;[...levelsEl.children].forEach((b, i) => { b.style.left = `${(geo.x0 + DETENTS[i] * (geo.x1 - geo.x0)) / geo.cw * 100}%` })
  }
  const ro = new ResizeObserver(() => layout()); ro.observe(stage); disposers.push(() => ro.disconnect())

  /* ── WebGL2 glass knob ── */
  const VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
void main(){ gl_Position = vec4(P[gl_VertexID], 0., 1.); }`
  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec4 uTrack; uniform float uScale; uniform vec4 uKnob; uniform vec3 uDeform; uniform float uT;
uniform sampler2D uNow; uniform sampler2D uDay;
out vec4 o;
vec3 scene(sampler2D tex, vec2 p){ vec2 q = (p - uTrack.xy) / uScale; ivec2 ip = ivec2(clamp(floor(q), vec2(0.), vec2(175., 49.))); return texelFetch(tex, ip, 0).rgb; }
float capsule(vec2 q, float a, float r, out vec2 n){ vec2 c = vec2(q.x, sign(q.y) * max(abs(q.y) - a, 0.)); float l = length(c); n = l > 1e-4 ? c / l : vec2(0., 1.); return l - r; }
vec2 toKnob(vec2 p, vec2 off){ vec2 q = p - uKnob.xy - off; q.x -= uDeform.z * q.y; return q / uDeform.xy; }
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 tc = uTrack.xy + uTrack.zw * .5; float tr = uTrack.w * .5;
  float dT = length(vec2(max(abs(p.x - tc.x) - (uTrack.z * .5 - tr), 0.), p.y - tc.y)) - tr;
  float r = uKnob.z, a = uKnob.w - r;
  vec2 nK; vec2 q = toKnob(p, vec2(0.)); float dK = capsule(q, a, r, nK);
  vec2 nS; float dS = capsule(toKnob(p, vec2(.16 * r, .26 * r)), a * .9, r * .92, nS);
  float shadow = 1. - smoothstep(-r * .45, r * .7, dS);
  vec4 col = vec4(0.);
  if (dT < 1.) {
    vec3 s = scene(uNow, p);
    s *= 1. - shadow * mix(.48, .32, uT);
    vec2 cf = (p - (uKnob.xy + vec2(.12 * r, uKnob.w * .72))) / vec2(r * 1.05, r * .3);
    s += vec3(1., .92, .78) * exp(-dot(cf, cf)) * mix(.42, .26, uT);
    float top = p.y - uTrack.y;
    s *= 1. - clamp(exp(-top / (uTrack.w * .09)) * .5 + exp(dT / (uTrack.w * .03)) * .28, 0., .65);
    float aT = clamp(.5 - dT, 0., 1.); col = vec4(s * aT, aT);
  } else {
    float lip = uTrack.w * .075, g = 1. - smoothstep(0., lip, dT);
    float lower = smoothstep(tc.y - tr * .1, tc.y + tr * 1.05, p.y);
    float aH = g * lower * smoothstep(lip * .2, lip * .7, dT) * mix(.10, .55, uT);
    float aG = g * (1. - smoothstep(0., lip * .5, dT)) * mix(.45, .18, uT);
    float aDark = 1. - (1. - aG) * (1. - shadow * .28);
    col = vec4(vec3(aH), aH + aDark * (1. - aH));
  }
  float ring = (1. - smoothstep(0., 2.5 * uScale * .25 + 1., dK)) * step(0., dK) * .22;
  col = col * (1. - ring) + vec4(0., 0., 0., ring);
  float aK = clamp(.5 - dK, 0., 1.);
  if (aK > 0.) {
    float depth = clamp(-dK / r, 0., 1.), e = 1. - clamp(-dK / (r * .38), 0., 1.);
    vec2 base = uKnob.xy + (p - uKnob.xy) / 1.28, bend = -nK * uDeform.xy * pow(e, 1.8) * r * .42;
    vec3 g; g.r = scene(uDay, base + bend * .82).r; g.g = scene(uDay, base + bend).g; g.b = scene(uDay, base + bend * 1.2).b;
    g = mix(vec3(dot(g, vec3(.299, .587, .114))), g, 1.18) * 1.06 + .01;
    g *= 1. - .5 * smoothstep(.35, .8, e) * (1. - smoothstep(.86, .97, e));
    g *= 1. - .12 * smoothstep(.2, 1., q.y / uKnob.w) * (1. - depth * .5);
    g = mix(g, mix(vec3(.58, .68, 1.), vec3(1., .78, .9), .5 + .5 * nK.y), pow(e, 2.5) * .32);
    g += pow(smoothstep(.86, 1., e), 3.) * .75;
    vec2 u = q / vec2(r, uKnob.w), s1 = mat2(.99, -.14, .14, .99) * (u - vec2(-.52, -.24));
    g += exp(-pow(s1.x / .075, 2.) - pow(s1.y / .48, 2.)) * .42;
    vec2 s2 = (u - vec2(.46, .70)) / vec2(.085, .04); g += exp(-dot(s2, s2)) * .9;
    col = col * (1. - aK) + vec4(g * aK, aK);
  }
  o = col;
}`
  let gl = null, U = {}, texNow, texDay, ctx2d = null, scratch = null, scratchCtx = null, img2d = null
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false }) } catch { gl = null }
  if (gl) {
    try {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
      const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
      gl.useProgram(prog)
      for (const n of ['uRes', 'uTrack', 'uScale', 'uKnob', 'uDeform', 'uT', 'uNow', 'uDay']) U[n] = gl.getUniformLocation(prog, n)
      gl.bindVertexArray(gl.createVertexArray()); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      const mk = unit => { const tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx)
        for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); return tx }
      texNow = mk(0); texDay = mk(1); gl.uniform1i(U.uNow, 0); gl.uniform1i(U.uDay, 1)
    } catch (err) { console.warn('[dsh-workroom] WebGL2 unavailable, using the 2D fallback', err); gl = null }
  }
  if (!gl) { ctx2d = canvas.getContext('2d'); scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H; scratchCtx = scratch.getContext('2d'); img2d = scratchCtx.createImageData(W, H) }
  const viewNow = new Uint8Array(bufNow.buffer), viewDay = new Uint8Array(bufDay.buffer)

  /* ── physics ── */
  const st = { x: 0.5, v: 0, target: 0.5, prevV: 0, wob: 0, wobV: 0, sq: 0, sqV: 0, dragging: false, loaded: false, lastLevel: 1 }
  const snap = x => DETENTS.reduce((best, d) => Math.abs(d - x) < Math.abs(best - x) ? d : best, DETENTS[0])
  function setTarget(x, commit) {
    st.target = x
    if (commit) saveLevel(levelIndex(x))
  }
  function step(dt) {
    const lv = levelIndex(st.x); if (lv !== st.lastLevel) { if (st.dragging) chime.tick(); st.lastLevel = lv }
    const k = st.dragging ? 260 : 170, c = 2 * Math.sqrt(k) * (st.dragging ? 0.62 : 0.5)
    st.v += (k * (st.target - st.x) - c * st.v) * dt; st.x += st.v * dt
    if (st.x < 0 || st.x > 1) { const impact = Math.abs(st.v); st.x = clamp(st.x, 0, 1); st.v = -st.v * 0.32; if (impact > 0.35 && !reduceMotion) st.sqV += impact * 1.4 }
    const travel = geo.x1 - geo.x0, vpx = st.v * travel, apx = (st.v - st.prevV) / dt * travel; st.prevV = st.v
    if (!reduceMotion) {
      const kw = 520, cw = 2 * Math.sqrt(kw) * 0.16; st.wobV += (-kw * st.wob - cw * st.wobV - clamp(apx / (geo.r * 10), -260, 260)) * dt; st.wob += st.wobV * dt
      const ks = 700, cs = 2 * Math.sqrt(ks) * 0.2; st.sqV += (-ks * st.sq - cs * st.sqV) * dt; st.sq += st.sqV * dt
    }
    return vpx
  }

  /* ── input ── */
  let pointer = null
  const posFromEvent = e => { const rect = housing.getBoundingClientRect(); return ((e.clientX - rect.left) * geo.dpr - geo.x0) / (geo.x1 - geo.x0) }
  const onDown = e => {
    if (e.button !== 0) return; housing.focus({ preventScroll: true }); housing.setPointerCapture(e.pointerId)
    const pos = posFromEvent(e), half = geo.r / (geo.x1 - geo.x0), onKnob = Math.abs(pos - st.x) <= half * 1.1
    pointer = { id: e.pointerId, x0: e.clientX, pos, onKnob, offset: onKnob ? st.x - pos : 0, moved: false }
    if (soundOn) ensureAudio()
  }
  const onMove = e => {
    if (!pointer || e.pointerId !== pointer.id) return
    if (!pointer.moved && Math.abs(e.clientX - pointer.x0) > 4) { pointer.moved = true; st.dragging = true; housing.classList.add('dragging') }
    if (pointer.moved) st.target = clamp(posFromEvent(e) + pointer.offset, 0, 1)
  }
  const onUp = e => {
    if (!pointer || e.pointerId !== pointer.id) return
    let x
    if (pointer.moved) x = snap(st.x + st.v * 0.15)
    else if (pointer.onKnob) x = DETENTS[(levelIndex(st.target) + 1) % 3]
    else x = snap(pointer.pos)
    pointer = null; st.dragging = false; housing.classList.remove('dragging')
    setTarget(x, true)
  }
  const onKey = e => {
    const i = levelIndex(st.target)
    const next = { ArrowLeft: i - 1, ArrowDown: i - 1, ArrowRight: i + 1, ArrowUp: i + 1, Home: 0, End: 2, ' ': (i + 1) % 3, Enter: (i + 1) % 3 }[e.key]
    if (next === undefined) return
    e.preventDefault(); setTarget(DETENTS[clamp(next, 0, 2)], true)
  }
  housing.addEventListener('pointerdown', onDown); housing.addEventListener('pointermove', onMove)
  housing.addEventListener('pointerup', onUp); housing.addEventListener('pointercancel', onUp); housing.addEventListener('keydown', onKey)

  /* ── readouts for the level ── */
  let shownLevel = -1
  function paintLevel(k) {
    const i = levelIndex(k); if (i === shownLevel) return; shownLevel = i
    const lv = LEVELS[i]
    $('[data-r="level"]').textContent = say(lv); $('[data-r="level-sub"]').textContent = say(`${lv}Sub`)
    housing.setAttribute('aria-valuenow', String(i)); housing.setAttribute('aria-valuetext', `${say(lv)}: ${say(`${lv}Sub`)}`)
    ;[...levelsEl.children].forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-pressed', String(j === i)) })
  }

  /* ── frame loop ── */
  let raf = 0, lastTime = performance.now(), simAcc = 0, vpx = 0, dayFrame = 0, alive = true
  const SIM_DT = 1 / 120
  function frame(now) {
    if (!alive) return
    simAcc += Math.min(0.5, Math.max(0, (now - lastTime) / 1000)); lastTime = now
    const time = now / 1000
    while (simAcc >= SIM_DT) { vpx = step(SIM_DT); simAcc -= SIM_DT }
    const k = clamp(st.x, 0, 1)
    if ((dayFrame & 63) === 0) { trySubscribe(); readStatus() }
    applyHousing(k); paintLevel(k)
    drawScene(bufNow, k, time)
    if (k > 0.999) bufDay.set(bufNow); else if ((dayFrame++ & 1) === 0) drawScene(bufDay, 1, time)
    const knobX = mix(geo.x0, geo.x1, st.x), knobY = geo.ty + geo.th / 2
    let sx = 1, sy = 1, shear = 0
    if (!reduceMotion) { sx = (1 + Math.min(0.3, Math.abs(vpx) / (geo.r * 60))) * (1 - clamp(st.sq, -0.25, 0.25) * 0.6); sy = 1 / sx; shear = clamp(st.wob, -0.35, 0.35) }
    if (gl) {
      gl.viewport(0, 0, geo.cw, geo.ch)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texNow); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, viewNow)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texDay); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, viewDay)
      gl.uniform2f(U.uRes, geo.cw, geo.ch); gl.uniform4f(U.uTrack, geo.tx, geo.ty, geo.tw, geo.th); gl.uniform1f(U.uScale, geo.s)
      gl.uniform4f(U.uKnob, knobX, knobY, geo.r, geo.halfH); gl.uniform3f(U.uDeform, sx, sy, shear); gl.uniform1f(U.uT, k)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3)
    } else if (ctx2d) {
      img2d.data.set(bufNow); scratchCtx.putImageData(img2d, 0, 0); ctx2d.clearRect(0, 0, geo.cw, geo.ch)
      ctx2d.save(); ctx2d.beginPath(); ctx2d.roundRect(geo.tx, geo.ty, geo.tw, geo.th, geo.th / 2); ctx2d.clip(); ctx2d.imageSmoothingEnabled = false; ctx2d.drawImage(scratch, geo.tx, geo.ty, geo.tw, geo.th); ctx2d.restore()
      ctx2d.save(); ctx2d.translate(knobX, knobY); ctx2d.beginPath(); ctx2d.roundRect(-geo.r, -geo.halfH, geo.r * 2, geo.halfH * 2, geo.r); ctx2d.fillStyle = 'rgba(255,255,255,.3)'; ctx2d.fill(); ctx2d.strokeStyle = 'rgba(255,255,255,.9)'; ctx2d.stroke(); ctx2d.restore()
    }
    raf = requestAnimationFrame(frame)
  }

  layout(); readStatus(); loadLevel()
  raf = requestAnimationFrame(frame)

  return {
    destroy() {
      alive = false; cancelAnimationFrame(raf)
      for (const d of disposers.splice(0)) { try { d() } catch { /* ignore */ } }
      housing.removeEventListener('pointerdown', onDown); housing.removeEventListener('pointermove', onMove)
      housing.removeEventListener('pointerup', onUp); housing.removeEventListener('pointercancel', onUp); housing.removeEventListener('keydown', onKey)
      try { gl?.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* ignore */ }
      try { ac?.close() } catch { /* ignore */ }
      root.innerHTML = ''
    },
  }
}

/* ───────────────────────── registration (last, so every constant above is initialised) ───────────────────────── */
window.__ModuleLoader__.load({
  id: 'dsh-workroom',
  factory(require) {
    const React = require('react')
    let services = null

    function WorkroomTab({ t }) {
      const ref = React.useRef(null)
      React.useEffect(() => {
        if (!ref.current || !services) return undefined
        const room = mountWorkroom(ref.current, services, t)
        return () => room.destroy()
      }, [])
      return React.createElement('div', { ref, className: 'dshw' })
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs', 'remote', 'remote.settings', 'uiSession'],
      apply(ctx) {
        const step = (label, fn) => { try { return fn() } catch (err) { console.error(`[dsh-workroom] ${label} failed`, err); throw err } }
        // The plugin owns its stylesheet: inserted on load, removed on unload or hot reload.
        step('styles', () => ctx.effect(() => {
          const el = document.createElement('style')
          el.dataset.dshWorkroom = ''
          el.textContent = CSS
          document.head.append(el)
          return () => el.remove()
        }))
        let status
        services = step('services', () => ({
          settings: ctx.remote.settings,
          onSettingsChanged: (fn) => ctx.remote.$on('settings/document-updated', fn),
          getStatus: () => status,
        }))
        // dsh 0.2.2-rc keeps the status table as a plain property of uiSession. Later releases publish it as its
        // own service and reject undeclared reads; there, wait for it with a nested injection. Never put it in the
        // top-level inject list: a service an older release lacks would hold the whole Web boot.
        try { status = ctx.uiSession.sessionStatus } catch (err) { console.info('[dsh-workroom] sessionStatus is not a plain property here', err?.message); status = undefined }
        if (!status) {
          step('late sessionStatus', () => ctx.inject(['uiSession.sessionStatus'], (scope) => {
            status = scope.uiSession.sessionStatus
            scope.effect(() => () => { status = undefined })
          }))
        }
        step('locale', () => ctx.effect(() => ctx.locale.register(LOCALE_NS, LOCALE)))
        step('tab type', () => ctx.effect(() => ctx.sidebarRightTabs.register({
          id: 'dsh-workroom',
          kind: 'workroom',
          title: () => tr('title'),
          guide: [{ id: 'workroom', order: 60, title: () => tr('title'), description: () => tr('guide') }],
        }), 'dsh-workroom: tab type'))
        step('tab body', () => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
          { name: 'sidebar.right.pane.tab', key: 'dsh-workroom', locale: LOCALE_NS },
          WorkroomTab,
        )))
        ctx.effect(() => () => { services = null })
      },
    }
  },
})

})();
