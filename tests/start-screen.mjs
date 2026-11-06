// v5 start screen: minimal layout, info card, camera note before the browser prompt, test mode via ?test.
//   SHOTS=dir node tests/start-screen.mjs
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';
const SHOTS = process.env.SHOTS;
const server = await serve(8150);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
let failed = 0;
const ok = (c, m) => { console.log(c ? '  ✓' : '  ✗', m); if (!c) failed++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  // ---- camera mode, permission NOT yet granted (prompt left pending: we only check what is shown before it)
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('http://localhost:8150/');
  await wait(600);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/start.png` });
  const vis = await p.evaluate(() => {
    const st = document.getElementById('screen-start');
    const visible = [...st.querySelectorAll('*')].filter((el) => el.offsetParent !== null && (el.children.length === 0 || el.classList.contains('logo')) && el.textContent.trim());
    return { texts: visible.map((el) => el.textContent.replace(/\u00a0/g, ' ').trim()), buttons: [...st.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim()),
      links: [...st.querySelectorAll('a')].filter((x) => x.offsetParent).length, dot: !!st.querySelector('.logo .logo-eye') };
  });
  ok(JSON.stringify(vis.texts) === JSON.stringify(['EYE MAZE', 'START', 'i']), `only the title, START and a small info button are visible: ${JSON.stringify(vis.texts)}`);
  ok(vis.dot && vis.links === 0, 'glowing dot kept; no test-mode link');
  const centred = await p.evaluate(() => { const r = document.getElementById('btn-start').getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 2; });
  ok(centred, 'START is centred');
  await p.click('#btn-info'); await wait(400);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/info.png` });
  ok(await p.evaluate(() => !document.getElementById('info').hidden && /Privacy/.test(document.getElementById('info').textContent) && /Look left/.test(document.getElementById('info').textContent)), 'info card shows how to play + privacy');
  await p.keyboard.press('Escape'); await wait(200);
  ok(await p.evaluate(() => document.getElementById('info').hidden), 'Escape closes it');
  await p.click('#btn-start'); await wait(500);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/camera-note.png` });
  ok(await p.evaluate(() => !document.getElementById('cam-note').hidden && document.getElementById('btn-start').hidden), 'START → short camera note replaces the button before the browser asks');
  ok(errs.length === 0, 'no page errors');
  await p.close();

  // ---- test mode still works from ?test
  const t = await b.newPage();
  await t.setViewport({ width: 1280, height: 800 });
  await t.goto('http://localhost:8150/?test');
  ok(await t.evaluate(() => !document.getElementById('proto-warn').hidden), 'test mode: small dev label only');
  await t.click('#btn-start');
  await t.waitForFunction(() => window.eyeMaze.phase === 'play', { timeout: 20000 });
  ok(true, 'test mode reaches play (no calibration)');

  // ---- phone portrait
  const m = await b.newPage();
  await m.setViewport({ width: 390, height: 844 });
  await m.goto('http://localhost:8150/'); await wait(500);
  if (SHOTS) await m.screenshot({ path: `${SHOTS}/start-phone.png` });
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no horizontal overflow');
} finally { await b.close(); server.close(); }
console.log(failed ? `${failed} failed` : 'START SCREEN CHECKS PASSED');
process.exitCode = failed ? 1 : 0;
