// End-to-end test for the dsh-skin-qq2007 client plugin, driven over CDP.
// usage: node tests/qq-skin.test.mjs --port 9333 --url <tokenized GUI url>
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(getArg('--port', '9333'));
const URL_ARG = getArg('--url', '');
const OUT_DIR = getArg('--out', path.join(process.cwd(), 'test-results'));

const results = [];
const consoleErrors = [];

function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === undefined ? '' : '  ' + JSON.stringify(detail)}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const entry = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
        else entry.resolve(message.result);
      } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        consoleErrors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      } else if (message.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(message.params.exceptionDetails?.exception?.description ?? 'exception');
      }
    };
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('websocket failed'));
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed');
    }
    return result.result.value;
  }

  async screenshot(file) {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  }
}

/** Snapshot the skin's observable state. */
const SNAPSHOT = String.raw`(() => {
  const q = (sel) => document.querySelector(sel);
  const bg = (sel) => {
    const el = q(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { color: cs.color, background: cs.backgroundColor, image: cs.backgroundImage, border: cs.borderColor };
  };
  const pseudo = (sel, which, prop) => {
    const el = q(sel);
    if (!el) return null;
    return getComputedStyle(el, which).getPropertyValue(prop).trim();
  };
  const style = [...document.querySelectorAll('style[data-plugin]')].find((s) => s.dataset.plugin === 'dsh-skin-qq2007');
  const toggle = q('.qq2007-toggle');
  return {
    skinOn: document.body.hasAttribute('data-dsh-qq-skin'),
    styleTag: Boolean(style),
    styleBytes: style ? style.textContent.length : 0,
    toggle: toggle ? { mode: toggle.dataset.mode, label: toggle.textContent.trim(), role: toggle.getAttribute('role') } : null,
    stored: (() => { try { return localStorage.getItem('dsh-skin-qq2007.mode'); } catch { return 'blocked'; } })(),
    brandText: pseudo('[class*="brandName"]', '::after', 'content'),
    brandMark: bg('[class*="brandMark"]'),
    sidebar: bg('[data-slot="sidebar"] > div'),
    header: bg('[data-slot="conversation.header"] header'),
    sidebarBand: bg('[data-slot="sidebar"] [data-window-drag="true"]'),
    composer: bg('[data-composer-card]'),
    canvas: bg('[data-conversation-content]'),
    onlineSuffix: pseudo('[data-slot="sidebar.settings"] [class*="label"]', '::after', 'content'),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    frameBox: (() => {
      const el = q('#root > div[data-slot="root"] > div');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return [Math.round(r.width), Math.round(r.height), window.innerWidth, window.innerHeight];
    })(),
  };
})()`;

const main = async () => {
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!target) throw new Error('no CDP page target');
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  if (URL_ARG) {
    await cdp.send('Page.navigate', { url: URL_ARG });
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Normalize to skin mode so the suite is order-independent.
  const startMode = await cdp.evaluate(
    `(() => { try { localStorage.setItem('dsh-skin-qq2007.mode', 'qq'); return localStorage.getItem('dsh-skin-qq2007.mode'); } catch { return 'blocked'; } })()`
  );
  if (startMode !== 'qq') throw new Error('localStorage unavailable: ' + startMode);
  await cdp.send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 5000));

  // ---- 1. plugin presence -------------------------------------------------
  let snap = await cdp.evaluate(SNAPSHOT);
  check('plugin style tag is injected', snap.styleTag, { bytes: snap.styleBytes });
  check('mode switch button is mounted', Boolean(snap.toggle), snap.toggle);
  check('skin attribute is on by default', snap.skinOn === true);
  check('switch label reads QQ in skin mode', snap.toggle?.label === 'QQ', snap.toggle?.label);

  // ---- 2. classic palette applied -----------------------------------------
  const blueTitle = (value) => Boolean(value) && value !== 'none' && /25, 121, 223|8, 112, 216|5, 98, 201/.test(value);
  check('title bar uses the 2007 blue gradient', blueTitle(snap.header?.image), snap.header?.image?.slice(0, 90));
  check(
    'sidebar band shares the title gradient',
    blueTitle(snap.sidebarBand?.image) && snap.sidebarBand.image === snap.header.image,
    snap.sidebarBand?.image?.slice(0, 60)
  );
  check(
    'sidebar surface is the blue-silver gradient',
    Boolean(snap.sidebar?.image) && snap.sidebar.image !== 'none' && snap.sidebar.image.includes('gradient'),
    snap.sidebar?.image?.slice(0, 70)
  );
  check(
    'composer card has the 1px blue border',
    /rgb\(127, 168, 208\)/.test(snap.composer?.border ?? ''),
    snap.composer?.border
  );
  check(
    'conversation canvas is the light paper sheet',
    Boolean(snap.canvas?.image && snap.canvas.image.includes('gradient')),
    snap.canvas?.image?.slice(0, 60)
  );

  // ---- 3. retro decorations ----------------------------------------------
  check('brand reads "DeepSeek 2007"', /DeepSeek 2007/.test(snap.brandText ?? ''), snap.brandText);
  check(
    'brand mark paints the penguin avatar',
    /data:image\/png;base64/.test(snap.brandMark?.image ?? ''),
    snap.brandMark?.image?.slice(0, 30)
  );
  check('account row appends the online tag', /在线/.test(snap.onlineSuffix ?? ''), snap.onlineSuffix);

  // ---- 4. layout safety ---------------------------------------------------
  check('no horizontal overflow', snap.overflowX <= 0, { overflowX: snap.overflowX });
  check(
    'frame keeps the full viewport box',
    Boolean(snap.frameBox) && snap.frameBox[0] === snap.frameBox[2] && snap.frameBox[1] === snap.frameBox[3],
    snap.frameBox
  );

  const shotDir = path.join(OUT_DIR);
  await cdp.screenshot(path.join(shotDir, 'skin-qq.png'));

  // ---- 5. native mode round trip -----------------------------------------
  await cdp.evaluate(`document.querySelector('.qq2007-toggle').click()`);
  await new Promise((r) => setTimeout(r, 600));
  snap = await cdp.evaluate(SNAPSHOT);
  check('switch turns the skin off', snap.skinOn === false);
  check('native mode label', snap.toggle?.label === '原生', snap.toggle?.label);
  check('native mode persists to storage', snap.stored === 'native', snap.stored);
  check(
    'native title bar drops the 2007 gradient',
    !blueTitle(snap.header?.image),
    snap.header?.image?.slice(0, 60)
  );
  check('native brand mark is restored', !/data:image\/png/.test(snap.brandMark?.image ?? ''), snap.brandMark?.image?.slice(0, 20));
  await cdp.screenshot(path.join(shotDir, 'skin-native.png'));

  // ---- 6. persistence across reload --------------------------------------
  await cdp.send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 5000));
  snap = await cdp.evaluate(SNAPSHOT);
  check('reload keeps native mode', snap.skinOn === false && snap.stored === 'native', snap.stored);

  await cdp.evaluate(`document.querySelector('.qq2007-toggle').click()`);
  await new Promise((r) => setTimeout(r, 400));
  await cdp.send('Page.reload', { ignoreCache: true });
  await new Promise((r) => setTimeout(r, 5000));
  snap = await cdp.evaluate(SNAPSHOT);
  check('reload keeps QQ mode', snap.skinOn === true && snap.stored === 'qq', snap.stored);
  check('skin restores its styles after reload', snap.styleBytes > 20000, { bytes: snap.styleBytes });
  await cdp.screenshot(path.join(shotDir, 'skin-qq-reload.png'));

  // ---- 7. runtime errors --------------------------------------------------
  const ownErrors = consoleErrors.filter((e) => /qq2007|dsh-skin/i.test(e));
  check('no console errors from the skin', ownErrors.length === 0, ownErrors.slice(0, 3));

  cdp.ws.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify({ url: URL_ARG, passed, failed, results, consoleErrors }, null, 2)
  );
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed === 0 ? 0 : 1;
};

main().catch((error) => {
  console.error('test harness failed: ' + error.message);
  process.exitCode = 2;
});
