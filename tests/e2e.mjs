// Browser acceptance run (Playwright + pre-installed Chromium): node tests/e2e.mjs
// Serves the repo locally, routes the pdf.js CDN to the local pdfjs-dist copy (same version), blocks Google Fonts.
// Writes screenshots to test-output/ (git-ignored).
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const out = root + 'test-output/';
mkdirSync(out, { recursive: true });

const server = createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await pw.chromium.launch({ executablePath: existsSync('/opt/pw-browsers/chromium') ? undefined : undefined });
async function newPage(viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions: [] });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/(cdn\.jsdelivr\.net\/npm\/pdfjs-dist@4\.10\.38\/build|cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/4\.10\.38)\/(pdf(\.worker)?\.min\.mjs)$/, (r, req) => {
    const f = req.url().split('/').pop();
    r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(root + 'node_modules/pdfjs-dist/build/' + f) });
  });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) page.errors.push(m.text()); });
  return page;
}
const text = (page, sel) => page.locator(sel).first().innerText();
const fx = readFileSync(root + 'fixtures/sgcm-e200-avantgarde-ctrl-a.txt', 'utf8');
const paste = (page, t) => page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, t);
const setVal = async (page, sel, v) => { await page.fill(sel, ''); await page.type(sel, v); };

// ---------------------------------------------------------------- A. V0.6 baseline vs V0.7 on the same sample data
{
  const b = await newPage();
  await b.goto(base + 'baseline/v0.6/motorway-pricing-desk.html');
  await setVal(b, '#offer', '95000');
  const v06 = { med: await text(b, '#sMed'), low: await text(b, '#sLow'), high: await text(b, '#sHigh'), dep: await text(b, '#sDep'), max: await text(b, '#maxAcq'), offer: await text(b, '#offerNote') };

  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.click('#subjDemo');
  await p.click('#subjGo');
  await p.click('#demoRes');
  await p.waitForSelector('#stPool:not([hidden])');
  await p.click('#toDesk');
  await setVal(p, '#offer', '95,000');
  const v07 = { med: await text(p, '#sMed'), low: await text(p, '#sLow'), high: await text(p, '#sHigh'), dep: await text(p, '#sDep'), max: await text(p, '#maxAcq'), gp: await text(p, '#gp') };
  check('A: median asking = V0.6', v07.med === v06.med, `${v07.med} vs ${v06.med}`);
  check('A: lowest / highest = V0.6', v07.low === v06.low && v07.high === v06.high, `${v07.low}·${v07.high}`);
  check('A: median depreciation = V0.6', v07.dep === v06.dep, v07.dep);
  check('A: maximum acquisition price = V0.6', v07.max === v06.max, v07.max);
  check('A: projected GP = V0.6 offer maths', v06.offer.includes(v07.gp), `${v07.gp} in "${v06.offer.slice(-40)}"`);
  check('A: Example inputs tag while defaults unchanged, hidden after edit', await p.isHidden('#exTag'));
  // tick / untick recalculates exactly like V0.6
  await p.check('#inc7'); await b.check('#inc7');
  check('A: ticking the short-COE row matches V0.6', (await text(p, '#sMed')) === (await text(b, '#sMed')), await text(p, '#sMed'));
  await p.screenshot({ path: out + 'desk-demo-1440.png', fullPage: true });
  await p.click('.nav button[data-go="decision"]');
  check('A: Decision shows same max', (await text(p, '#decBody .dmax .big')) === v06.max);
  await setVal(p, '#final', '96,000');
  await p.click('.nav button[data-go="desk"]');
  check('A: Final offer on Decision is the same field as Starting offer', (await p.inputValue('#offer')) === '96,000');
  await p.click('.nav button[data-go="decision"]');
  await p.screenshot({ path: out + 'decision-demo-1440.png', fullPage: true });
  check('A: no page errors', !p.errors.length && !b.errors.length, [...p.errors, ...b.errors].join(' | '));
  await b.context().close(); await p.context().close();
}

// ---------------------------------------------------------------- B. LTA synthetic PDF + mileage → subject car (Taycan)
{
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.screenshot({ path: out + 'subject-empty-1440.png' });
  await p.setInputFiles('#ltaFile', root + 'fixtures/lta-taycan-4s-synthetic.pdf');
  await p.waitForSelector('#subjReview:not([hidden])', { timeout: 15000 });
  const rv = await text(p, '#subjRows');
  for (const s of ['Porsche', 'Taycan 4S 4+1', '2021', '29 Apr 2022', 'Electric', '$136,610', '$182,898', '28 Apr 2032', '$80,210', '$91,449'])
    check(`B: review shows ${s}`, rv.includes(s));
  check('B: review shows owners 3 (2 transfers + 1)', /Owners\s*3/.test(rv));
  check('B: continue blocked until mileage entered', await p.isDisabled('#subjGo'));
  await setVal(p, '#subjKm', '35000');
  check('B: mileage formatted', (await p.inputValue('#subjKm')) === '35,000');
  check('B: COE left 5y 6m original', rv.includes('5y 6m') || (await text(p, '#subjRows')).includes('5y 6m · original'));
  await p.screenshot({ path: out + 'subject-review-1440.png', fullPage: true });
  // Edit as fallback: change colour, then check it is marked as edited.
  await p.click('button[data-edit="colour"]');
  await p.fill('#ed_colour', 'White');
  await p.press('#ed_colour', 'Enter');
  check('B: edited field is labelled as dealer-edited', (await text(p, '#subjRows')).includes('edited by dealer'));
  await p.click('#subjGo');
  const band = await text(p, '#band');
  check('B: band shows the Taycan', band.includes('Porsche Taycan 4S 4+1'), band.replace(/\n/g, ' · ').slice(0, 160));
  check('B: band shows 35,000 km, 3 owners, 5y 6m, PARF', ['35,000', '5y 6m', '$91,449', '$136,610', '$182,898'].every(s => band.includes(s)));
  await p.screenshot({ path: out + 'paste-empty-1440.png' });
  await paste(p, fx);
  await p.waitForSelector('#stPool:not([hidden])');
  const strip = await text(p, '#strip');
  check('B: strip shows 100 listings, 84 active, 16 sold', strip.includes('100') && /84\s*active/.test(strip) && /16\s*sold/.test(strip), strip.replace(/\n/g, ' · '));
  check('B: Taycan vs E200 paste → shortlist explains no model match', (await text(p, '#poolBody')).includes('matches this car’s model family'));
  check('B: nothing on the page mentions the whitelist-skipped labels’ values', !(await p.content()).includes('REDACTED'));
  check('B: no page errors', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// ---------------------------------------------------------------- C. Sample E200 car + real SGCarMart paste → full loop
{
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.click('#subjDemo');
  await p.click('#subjGo');
  await paste(p, fx);
  await p.waitForSelector('#stPool:not([hidden])');
  const S = await p.evaluate(() => { const s = window.__mpd.state; return { short: s.pool.shortlist, sold: s.listings.filter(l => l.sold).map(l => l.id), inc: s.inc }; });
  check('C: shortlist has rows', S.short.length > 0, `${S.short.length} rows`);
  check('C: no sold listing shortlisted or ticked', S.sold.every(id => !S.short.includes(id) && !S.inc[id]));
  await p.screenshot({ path: out + 'pool-shortlist-1440.png', fullPage: true });
  await p.click('button[data-tab="all"]');
  const all = await text(p, '#poolBody');
  check('C: All parsed shows tiers incl. Set aside and sold note', all.includes('SET ASIDE') && all.includes('Sold · SGCarMart listing status'), '');
  await p.screenshot({ path: out + 'pool-all-1440.png' });
  await p.click('button[data-tab="ign"]');
  check('C: Ignored tab lists the Alphard ad block', (await text(p, '#poolBody')).includes('Alphard'));
  await p.click('button[data-tab="short"]');
  await p.click('#toDesk');
  const rows = await p.locator('#rows tr').count();
  check('C: desk shows baseline + shortlisted rows', rows === S.short.length + 1, `${rows} rows`);
  await setVal(p, '#resale', '60000'); await setVal(p, '#recon', '2000'); await setVal(p, '#other', '1000'); await setVal(p, '#profit', '5000'); await setVal(p, '#offer', '50000');
  check('C: max = 60,000 − 2,000 − 1,000 − 5,000', (await text(p, '#maxAcq')) === '$52,000');
  check('C: GP at 50,000 offer', (await text(p, '#gp')) === '$7,000');
  await p.click('#secBtn');
  await p.screenshot({ path: out + 'desk-real-1440.png', fullPage: true });
  await p.click('.nav button[data-go="decision"]');
  const dec = await text(p, '#decBody');
  check('C: Decision has all eight sections', ['01', '02', '03', '04', '05', '06', '07 · 08'].every(n => dec.includes(n)) && dec.includes('Owner makes the final decision.'));
  check('C: Decision notes sold listings were kept out', dec.includes('16 sold listings were parsed'));
  check('C: AI block present, advisory, never hidden', dec.includes('ADVISORY · NOT A VALUATION · NOT THE MAXIMUM') && dec.includes('No second opinion available'));
  await p.screenshot({ path: out + 'decision-real-1440.png', fullPage: true });
  check('C: no page errors', !p.errors.length, p.errors.join(' | '));

  // D. 390 px (A7)
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: out + 'decision-real-390.png', fullPage: true });
  await p.click('.nav button[data-go="desk"]');
  check('D: phone shows cards, not the table', await p.isVisible('#mcards') && await p.isHidden('#deskTable'));
  check('D: no horizontal page scroll at 390', await p.evaluate(() => document.documentElement.scrollWidth <= 390), String(await p.evaluate(() => document.documentElement.scrollWidth)));
  await p.screenshot({ path: out + 'desk-real-390.png', fullPage: true });
  await p.click('.nav button[data-go="import"]');
  check('D: no horizontal page scroll on import at 390', await p.evaluate(() => document.documentElement.scrollWidth <= 390), String(await p.evaluate(() => document.documentElement.scrollWidth)));
  await p.screenshot({ path: out + 'pool-real-390.png', fullPage: true });
  await p.context().close();
}
{
  const p = await newPage({ width: 390, height: 844 });
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.setInputFiles('#ltaFile', root + 'fixtures/lta-taycan-4s-synthetic.pdf');
  await p.waitForSelector('#subjReview:not([hidden])', { timeout: 15000 });
  await setVal(p, '#subjKm', '35000');
  check('D: subject review has no horizontal scroll at 390', await p.evaluate(() => document.documentElement.scrollWidth <= 390));
  await p.screenshot({ path: out + 'subject-review-390.png', fullPage: true });
  await p.context().close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed · screenshots in test-output/`);
process.exit(fail ? 1 : 0);
