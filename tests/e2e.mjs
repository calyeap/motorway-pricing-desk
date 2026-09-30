// Browser acceptance run (Playwright + pre-installed Chromium): node tests/e2e.mjs
// Serves the repo locally (pdf.js is vendored in vendor/), blocks Google Fonts and the pdf.js CDN fallbacks
// so the local copy is proven to be the one used. Writes screenshots to test-output/ (git-ignored).
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

const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.pdf': 'application/pdf' };
const server = createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await pw.chromium.launch();
async function newPage(viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) page.errors.push(m.text()); });
  return page;
}
const text = (page, sel) => page.locator(sel).first().innerText();
const document_has = (html, id) => html.includes('id="' + id + '"');
const E200 = readFileSync(root + 'fixtures/sgcm-e200-avantgarde-ctrl-a.txt', 'utf8');
const TAYCAN = readFileSync(root + 'fixtures/sgcm-taycan-4s-ctrl-a.txt', 'utf8');
const paste = (page, t) => page.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, t);
const setVal = async (page, sel, v) => { await page.fill(sel, ''); await page.type(sel, v); };
const next = (page) => page.click('#actNext');
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const inViewport = (page, sel) => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0; }, sel);
async function taycanSubject(p) {
  await p.setInputFiles('#ltaFile', root + 'fixtures/lta-taycan-4s-synthetic.pdf');
  await p.waitForSelector('#subjReview:not([hidden])', { timeout: 15000 });
  await setVal(p, '#subjKm', '35000');
}

// ---------------------------------------------------------------- A. V0.6 baseline vs V0.8 on the same sample data
{
  const b = await newPage();
  await b.goto(base + 'baseline/v0.6/motorway-pricing-desk.html');
  await setVal(b, '#offer', '95000');
  const v06 = { med: await text(b, '#sMed'), low: await text(b, '#sLow'), high: await text(b, '#sHigh'), dep: await text(b, '#sDep'), max: await text(b, '#maxAcq'), offer: await text(b, '#offerNote') };

  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.click('#subjDemo');
  await next(p);
  await p.click('#demoRes');
  await p.waitForSelector('#stPool:not([hidden])');
  await next(p);
  await setVal(p, '#offer', '95,000');
  const v08 = { med: await text(p, '#sMed'), low: await text(p, '#sLow'), high: await text(p, '#sHigh'), dep: await text(p, '#sDep'), max: await text(p, '#maxAcq'), gp: await text(p, '#gp') };
  check('A: median asking = V0.6', v08.med === v06.med, `${v08.med} vs ${v06.med}`);
  check('A: lowest / highest = V0.6', v08.low === v06.low && v08.high === v06.high, `${v08.low}·${v08.high}`);
  check('A: median depreciation = V0.6', v08.dep === v06.dep, v08.dep);
  check('A: maximum acquisition price = V0.6', v08.max === v06.max, v08.max);
  check('A: projected GP = V0.6 offer maths', v06.offer.includes(v08.gp), `${v08.gp}`);
  check('A: sample data has 3 exact Avantgarde → not thin', /3\s*exact variant, independent/i.test(await text(p, '#market')) && !/thin market/i.test(await text(p, '#market')));
  await p.check('#inc7'); await b.check('#inc7');
  check('A: ticking the short-COE row matches V0.6', (await text(p, '#sMed')) === (await text(b, '#sMed')), await text(p, '#sMed'));
  check('A: desktop next CTA visible without scrolling', await inViewport(p, '#actNext') && (await text(p, '#actNext')).includes('Decision Summary'));
  await next(p);
  check('A: Decision shows same max', (await text(p, '#decBody .dmax .big')) === v06.max);
  await setVal(p, '#final', '96,000');
  await p.click('#actBack');
  check('A: final offer does NOT overwrite the dealer starting offer (B7)', (await p.inputValue('#offer')) === '95,000');
  await next(p);
  check('A: final offer kept as owner input', (await p.inputValue('#final')) === '96,000' && (await text(p, '#finalGp')) === '$11,000');
  check('A: no page errors', !p.errors.length && !b.errors.length, [...p.errors, ...b.errors].join(' | '));
  await b.context().close(); await p.context().close();
}

// ---------------------------------------------------------------- B. Taycan: synthetic LTA PDF + mileage + real Taycan paste
{
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await taycanSubject(p);
  const rv = await text(p, '#subjRows');
  for (const s of ['Porsche', 'Taycan 4S 4+1', '2021', '29 Apr 2022', 'Electric', '$136,610', '$182,898', '28 Apr 2032', '$80,210', '$91,449'])
    check(`B: review shows ${s}`, rv.includes(s));
  check('B: owners labelled derived, transfers as source', /Owners \(derived\)\s*3/.test(rv) && /Number of transfers\s*2/.test(rv));
  check('B: COE original marked inferred', rv.includes('5y 6m · original (inferred)'));
  check('B: privacy wording', (await text(p, '#stSubject')).includes('Only allowlisted vehicle fields are retained/displayed. Personal fields are discarded and not stored.') && !(await p.content()).includes('skipped unread'));
  check('B: pdf.js loaded from the repo (CDNs blocked)', rv.includes('Porsche'));
  await p.screenshot({ path: out + 'v08-subject-1440.png', fullPage: true });
  await next(p);
  const band = await text(p, '#band');
  check('B: band shows transfers as source + owners derived', band.includes('Porsche Taycan 4S 4+1') && /TRANSFERS\s*2/i.test(band) && band.includes('owners 3 (derived)'), band.replace(/\n/g, ' · ').slice(0, 200));
  await paste(p, TAYCAN);
  await p.waitForSelector('#stPool:not([hidden])');
  const S = await p.evaluate(() => { const s = window.__mpd.state; return { short: s.pool.shortlist, inc: s.inc, own: s.listings.filter(l => l.own).map(l => l.id), same: s.listings.filter(l => l.possibleSame).map(l => l.id), cls: s.listings.map(l => l.vclass) }; });
  check('B: 9 listings, Motorway stock = listing 5', (await text(p, '#strip')).includes('9') && JSON.stringify(S.own) === '[5]');
  check('B: Motorway stock shown for context, unticked', S.short.includes(5) && !S.inc[5]);
  check('B: possible same car flagged', JSON.stringify(S.same) === '[5]');
  const pool = await text(p, '#poolBody');
  check('B: pool labels Motorway stock + possible same car', /Motorway stock · not independent evidence/i.test(pool) && /Possible same car/i.test(pool));
  check('B: row shows the short related-variant flag; full reason lives in Details', /Related variant · not same spec/i.test(pool) && await p.evaluate(() => document.querySelector('#poolBody').textContent.includes('Related variant — Performance Battery Plus · not the same spec')));
  check('B: pool shows SGCarMart Posted date as days ago (not time on market)', /Posted 28 Sep · (\d+ days ago|1 day ago|today)/.test(pool) && !/on market/i.test(pool));
  check('B: Why picked is behind Details (own subsection), not on the row', !pool.includes('Why picked') && !pool.includes('Why this comp') && await p.evaluate(() => [...document.querySelectorAll('#poolBody details.story')].some(d => d.textContent.includes('Why picked') && d.textContent.includes('registered'))));
  check('B: Details keeps Why picked and Car story as separate subsections', await p.evaluate(() => [...document.querySelectorAll('#poolBody details.story')].some(d => d.textContent.includes('Why picked') && d.textContent.includes('Car story / seller notes'))));
  check('B: thin market in pool footer', (await text(p, '#poolFoot')).includes('THIN MARKET / REVIEW'));
  await p.click('button[data-tab="all"]');
  check('B: Cross Turismo set aside as different body style', (await text(p, '#poolBody')).includes('Different body style — Cross Turismo'));
  await p.click('#pExc');
  const exc = await p.evaluate(() => document.querySelectorAll('#poolBody tbody tr:not(.tier):not(.ref)').length);
  check('B: exceptions-only filter narrows the list', exc > 0 && exc < 9, `${exc} rows`);
  await p.click('#pExc');
  await p.click('button[data-tab="short"]');
  await p.screenshot({ path: out + 'v08-pool-taycan-1440.png', fullPage: true });
  await next(p);
  const mk = await text(p, '#market');
  check('B: rail says THIN MARKET / REVIEW; reasons behind Details', mk.includes('THIN MARKET / REVIEW') && !mk.includes('0 exact-variant independent') && await p.evaluate(() => { const t = document.querySelector('#market').textContent; return t.includes('0 exact-variant independent') && t.includes('Motorway stock'); }));
  check('B: Motorway stock excluded from median by default', (await text(p, '#sMed')) === '$378,800');
  await setVal(p, '#resale', '330000');
  check('B: blank-cost state shown once, inside the max block', !document_has(await p.content(), 'blankWarn') && await p.isVisible('#maxBlk .provnote') && (await text(p, '#maxBlk .provnote')).includes('blank') && (await text(p, '#maxBlk')).includes('MAXIMUM ACQUISITION PRICE') && !(await text(p, '#maxBlk')).includes('DETERMINISTIC'));
  check('B: expected resale stays dealer input (never auto-set)', (await p.inputValue('#resale')) === '330,000');
  await p.screenshot({ path: out + 'v08-desk-taycan-1440.png', fullPage: true });
  await next(p);
  const dec = await text(p, '#decBody');
  check('B: Decision leads with exceptions (thin, same car, blank costs)', dec.indexOf('Exceptions to review') < dec.indexOf('Market evidence') && dec.includes('Thin market / review') && dec.includes('Possible same car') && dec.includes('Some costs are blank and currently treated as $0'));
  check('B: Decision exceptions no longer list the owners rule (dealer-confirmed)', !/Owners \(derived\)\s*—/.test(dec) && !/not yet confirmed/i.test(dec) && dec.includes('owners 3 (derived)'));
  check('B: Decision names related variants, not adjacent', dec.includes('Related variants') && !/Adjacent/.test(dec));
  check('B: Decision dealer inputs show Target profit buffer', dec.includes('Target profit buffer') && !dec.includes('Target gross profit'));
  const sum = await p.evaluate(() => window.__mpd.ownerSummary());
  check('B: owner summary has state, exact/related, own stock, max, disclaimer', ['THIN MARKET / REVIEW', 'Exact independent comps: 0', 'related (not same spec): 3', 'Motorway stock excluded', 'MAXIMUM ACQUISITION: $330,000 (PROVISIONAL', 'Asking prices are not sale prices.'].every(x => sum.includes(x)), sum.replace(/\n/g, ' | '));
  check('B: owner summary has no valuation language', !/valuation|market value|worth/i.test(sum));
  await p.screenshot({ path: out + 'v08-decision-taycan-1440.png', fullPage: true });
  check('B: no page errors', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// ---------------------------------------------------------------- C. Privacy: dense fake-PII layout PDF
{
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.setInputFiles('#ltaFile', root + 'fixtures/lta-layout-fake-pii.pdf');
  await p.waitForSelector('#subjReview:not([hidden])', { timeout: 15000 });
  const html = await p.content();
  const leaked = ['JOHN', 'DOE', 'S0000000A', 'FAKE STREET', 'JANE', 'ROE', '1980', 'SXX1234Z', 'WP0ZZZ', 'FAKEMOTOR', '1234567890', '9000 0000'].filter(x => html.includes(x));
  check('C: no fake personal value reaches the page', !leaked.length, leaked.join(', '));
  const st = await p.evaluate(() => JSON.stringify(window.__mpd.state));
  check('C: no fake personal value in app state', !/JOHN|DOE|S0000000A|FAKE STREET|JANE|1980|SXX1234Z|WP0ZZZ/.test(st));
  check('C: vehicle fields still read', (await text(p, '#subjRows')).includes('Taycan 4S 4+1') && (await text(p, '#subjRows')).includes('28 Apr 2027'));
  await p.context().close();
}

// ---------------------------------------------------------------- D. Snapshots + Market Pulse
{
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await taycanSubject(p);
  await next(p);
  // "Paste & save today": clipboard read is blocked in the test browser, so the button falls back to the paste box.
  await p.click('#pasteSaveBtn');
  const dl = p.waitForEvent('download');
  await paste(p, TAYCAN);
  const file = await dl;
  const snapPath = out + 'snapshot-taycan.json';
  await file.saveAs(snapPath);
  const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
  check('D: Paste & save today downloads a snapshot', snap.kind === 'mpd-market-snapshot' && snap.captured === 9 && snap.sgcmTotal === 9 && snap.search === 'porsche taycan 4s', file.suggestedFilename());
  check('D: snapshot holds no subject / LTA data', !/Taycan 4S 4\+1|35000|136610|182898|coeExpiry|transfers/.test(JSON.stringify(snap)));
  // Next capture: listing 1 cut $10k, listing 2 gone, listing 5 now sold.
  let today = TAYCAN.replace('$378,800', '$368,800');
  today = today.replace(/Porsche Taycan Electric 4S Performance Battery Plus\r?\nPorsche Taycan Electric 4S Performance Battery Plus\r?\n\$458,000[\s\S]*?Compare\r?\n/, '');
  today = today.replace('Porsche Taycan Electric 4S\r\nPremium Ad\r\nPorsche Taycan Electric 4S\r\n$342,000', 'soldPorsche Taycan Electric 4S\r\nPremium Ad\r\nPorsche Taycan Electric 4S\r\nsold\r\nView Similar').replace('9 Vehicles', '8 Vehicles').replace('9 Vehicles', '8 Vehicles');
  await p.click('#pasteAgain');
  await paste(p, today);
  await p.waitForSelector('#stPool:not([hidden])');
  await p.setInputFiles('#snapFile', snapPath);
  await p.waitForSelector('#pulse:not([hidden])');
  const pulse = await text(p, '#pulse');
  check('D: pulse shows price reduction', /Price reductions\s*1/.test(pulse));
  check('D: disappeared listing = No longer listed, not sold', /No longer listed\s*1/.test(pulse) && /Marked sold by SGCarMart\s*1/.test(pulse));
  check('D: pulse has a market read and never claims demand', /Market read/i.test(pulse) && !/demand/i.test(pulse.replace('not sales or demand', '').replace('not proof of low demand', '')));
  check('D: pulse leads with the market read, figures after', pulse.indexOf('MARKET READ') >= 0 && pulse.indexOf('MARKET READ') < pulse.indexOf('Price reductions') && /30 Sep 2026 → 30 Sep 2026/.test(pulse));
  check('D: pulse counts are "Active listings in this capture"', /Active listings in this capture\s*5 → 3/.test(pulse) && !/sitting in the market/i.test(pulse));
  check('D: pulse caveat: price cuts = seller pressure, gone ≠ sold', pulse.includes('Price cuts show seller pressure, not proof of low demand.') && pulse.includes('Gone ≠ sold unless SGCarMart marks it sold.'));
  // Softer read → buffer guidance in the rail; the maximum itself never moves because of the pulse.
  await next(p);
  await setVal(p, '#resale', '330000');
  const maxWithPulse = await text(p, '#maxAcq');
  check('D: softer asking evidence → "consider a larger profit buffer" shown by the buffer input', (await text(p, '#pulseHint')).includes('consider a larger profit buffer') && await p.isVisible('#pulseHint'));
  check('D: pulse never changes the maximum (330,000 − 0 − 0 − 0)', maxWithPulse === '$330,000');
  await p.click('#actBack');
  await p.screenshot({ path: out + 'v08-pulse-1440.png', fullPage: true });
  // Coverage mismatch: E200 page 1 of 180 against itself minus rows → loud warning, no removals
  await p.click('#pasteAgain');
  await paste(p, E200);
  await p.waitForSelector('#stPool:not([hidden])');
  const snapE = await p.evaluate(() => { const s = window.__mpd.state; return null; });
  const eSnapPath = out + 'snapshot-e200.json';
  const dl2 = p.waitForEvent('download');
  await p.click('#saveSnap');
  await (await dl2).saveAs(eSnapPath);
  await p.click('#pasteAgain');
  await paste(p, E200.replace(/Mercedes-Benz E-Class E200 Avantgarde\r?\nPremium Ad\r?\nMercedes-Benz E-Class E200 Avantgarde\r?\n\$61,800[\s\S]*?Compare\r?\n/, ''));
  await p.waitForSelector('#stPool:not([hidden])');
  await p.setInputFiles('#snapFile', eSnapPath);
  await p.waitForSelector('#pulse:not([hidden])');
  const pulse2 = await text(p, '#pulse');
  check('D: mismatched / partial coverage warns loudly', pulse2.includes('Capture coverage is partial') && pulse2.includes('Not comparable'));
  check('D: partial coverage never classifies absences as no longer listed', /Not in this capture \(coverage differs\)\s*1/.test(pulse2) && !/\nNo longer listed\s*\d/.test(pulse2));
  check('D: no page errors', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// ---------------------------------------------------------------- E. Phone (~390 px): review / decision
{
  const p = await newPage({ width: 390, height: 844 });
  await p.goto(base + 'motorway-pricing-desk.html');
  await taycanSubject(p);
  check('E: sticky Continue visible on phone at subject review', await inViewport(p, '#actNext') && await p.isEnabled('#actNext'));
  const tb = await p.evaluate(() => document.querySelector('#actNext').getBoundingClientRect());
  check('E: primary CTA is a large tap target', tb.height >= 44 && tb.width >= 200, `${Math.round(tb.width)}×${Math.round(tb.height)}`);
  check('E: no horizontal scroll (subject)', await noHScroll(p));
  await p.screenshot({ path: out + 'v08-subject-390.png', fullPage: false });
  await next(p);
  check('E: phone paste step says capture is a desktop step', (await text(p, '#stPaste')).includes('Capture is a desktop step'));
  await paste(p, TAYCAN);
  await p.waitForSelector('#stPool:not([hidden])');
  const bandM = await text(p, '#band');
  check('E: phone band shows owners, not transfers (35,000 km · 3 owners · 5y 6m)', /35,000\s*km/.test(bandM) && /3\s*owners/.test(bandM) && !/transfers/i.test(bandM) && /5y 6m/.test(bandM) && !/inferred/.test(bandM));
  check('E: phone sticky labels are short', (await text(p, '#actBack')) === '← Back' && (await text(p, '#actNext')) === 'Comparison →');
  check('E: shortlist as readable cards with evidence', await p.isVisible('#poolCards .mc') && (await text(p, '#poolCards')).includes('DEP / YR') && /Motorway stock/i.test(await text(p, '#poolCards')));
  const tog = await p.evaluate(() => { const b = document.querySelector('#poolCards .tapck').getBoundingClientRect(); return [b.width, b.height]; });
  check('E: card include toggle ≥ 44 px', tog[0] >= 44 && tog[1] >= 44, tog.join('×'));
  check('E: sticky Continue to Comparison on phone', await inViewport(p, '#actNext') && (await text(p, '#actNext')).includes('Comparison'));
  check('E: no horizontal scroll (pool)', await noHScroll(p));
  // Impeccable #3/#4: every visible control ≥ 44 px tall on the phone; no text under 11 px (eyebrows) / 12 px (everything else).
  const small = (page) => page.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden'; };
    const ctl = [...document.querySelectorAll('button, a, input:not([type=checkbox]):not([type=file]), select, summary, label.pill, label.tapck')].filter(vis).map(e => ({ t: (e.innerText || e.id || e.tagName).trim().slice(0, 30), h: Math.round(e.getBoundingClientRect().height) })).filter(x => x.h < 44);
    const txt = [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).map(e => ({ t: e.textContent.trim().slice(0, 30), fs: parseFloat(getComputedStyle(e).fontSize), eb: !!(e.closest('.eyebrow') || e.closest('summary') || e.closest('.lab')) })).filter(x => x.fs < (x.eb ? 11 : 12));
    return { ctl, txt };
  });
  let sm = await small(p);
  check('E: pool — all controls ≥ 44 px tall', !sm.ctl.length, sm.ctl.map(x => `${x.t} ${x.h}`).join(' | '));
  check('E: pool — no text under 12 px (eyebrows 11)', !sm.txt.length, sm.txt.map(x => `${x.t} ${x.fs}`).join(' | '));
  await p.screenshot({ path: out + 'v08-pool-390.png', fullPage: true });
  await next(p);
  check('E: phone desk shows cards and sticky Decision CTA with max', await p.isVisible('#mcards .mc') && await inViewport(p, '#actNext') && (await text(p, '#actNext')).includes('Decision') && await p.isVisible('#actMid .maxchip'));
  check('E: no horizontal scroll (desk)', await noHScroll(p));
  // Impeccable #2: money inputs are real thumb targets and never trigger iOS zoom (≥ 16 px text).
  const inp = await p.evaluate(() => ['resale', 'recon', 'other', 'profit', 'offer'].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return [id, Math.round(r.height), Math.round(r.width), parseFloat(getComputedStyle(e).fontSize)]; }));
  check('E: desk money inputs ≥ 44 px tall, ≥ 128 px wide, 16 px text', inp.every(x => x[1] >= 44 && x[2] >= 128 && x[3] >= 16), inp.map(x => x.join(':')).join(' '));
  sm = await small(p);
  check('E: desk — all controls ≥ 44 px tall', !sm.ctl.length, sm.ctl.map(x => `${x.t} ${x.h}`).join(' | '));
  check('E: desk — no text under 12 px (eyebrows 11)', !sm.txt.length, sm.txt.map(x => `${x.t} ${x.fs}`).join(' | '));
  const cs = await p.evaluate(() => { const g = getComputedStyle(document.documentElement); return [g.getPropertyValue('--delta').trim(), g.getPropertyValue('--unit').trim()]; });
  check('E: phone deltas and units use muted #6B6B6B (≥ 4.5:1)', cs.every(c => c.toUpperCase() === '#6B6B6B'), cs.join(' '));
  await setVal(p, '#resale', '330000');
  await p.screenshot({ path: out + 'v08-desk-390.png', fullPage: true });
  await next(p);
  check('E: phone Decision has a clear heading', await p.isVisible('#decBody .dechead') && (await text(p, '#decBody .dechead')) === 'Decision Summary');
  check('E: phone evidence figures stack as rows', await p.evaluate(() => { const d = [...document.querySelectorAll('#decBody .tldr > div')]; return d.length === 3 && d.every(x => getComputedStyle(x).display === 'flex'); }));
  check('E: phone Decision: Copy owner summary is the sticky primary action', (await text(p, '#actNext')) === 'Copy owner summary' && await inViewport(p, '#actNext'));
  check('E: no horizontal scroll (decision)', await noHScroll(p));
  const order = await p.evaluate(() => ['Exceptions to review', 'Market evidence', 'Maximum acquisition price', 'Final offer'].map(t => document.querySelector('#decBody').innerText.indexOf(t.toUpperCase()) >= 0 ? document.querySelector('#decBody').innerText.indexOf(t.toUpperCase()) : document.querySelector('#decBody').innerText.indexOf(t)));
  check('E: phone order car → exceptions → evidence → max → final offer', order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), order.join(','));
  const maxFont = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#decBody .dmax .big')).fontSize));
  check('E: large Maximum Acquisition on phone', maxFont >= 30, String(maxFont));
  await p.screenshot({ path: out + 'v08-decision-390.png', fullPage: true });
  sm = await small(p);
  check('E: decision — all controls ≥ 44 px tall', !sm.ctl.length, sm.ctl.map(x => `${x.t} ${x.h}`).join(' | '));
  check('E: decision — no text under 12 px (eyebrows 11)', !sm.txt.length, sm.txt.map(x => `${x.t} ${x.fs}`).join(' | '));
  check('E: no page errors', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// ---------------------------------------------------------------- E2. Phone (~390 px): Market Pulse must never overflow (Impeccable #1)
// Worst case is the coverage-mismatch pulse: longest row label + longest "Market read" + amber warning. Uses the Taycan snapshot saved in D.
{
  const p = await newPage({ width: 390, height: 844 });
  await p.goto(base + 'motorway-pricing-desk.html');
  await taycanSubject(p);
  await next(p);
  // Same search, one listing missing, header still says 9 → partial coverage → "Not in this capture (coverage differs)".
  await paste(p, TAYCAN.replace(/Porsche Taycan Electric 4S Performance Battery Plus\r?\nPorsche Taycan Electric 4S Performance Battery Plus\r?\n\$458,000[\s\S]*?Compare\r?\n/, ''));
  await p.waitForSelector('#stPool:not([hidden])');
  await p.setInputFiles('#snapFile', out + 'snapshot-taycan.json');
  await p.waitForSelector('#pulse:not([hidden])');
  const pulse = await text(p, '#pulse');
  check('E2: coverage-mismatch pulse rendered on phone', pulse.includes('Not in this capture (coverage differs)') && pulse.includes('Not comparable — capture coverage differs'));
  check('E2: no horizontal scroll with Market Pulse open (390 px)', await noHScroll(p), String(await p.evaluate(() => document.documentElement.scrollWidth)));
  const over = await p.evaluate(() => [...document.querySelectorAll('#pulse, #pulse *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 0.5).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)));
  check('E2: no Market Pulse element extends past the viewport', !over.length, over.slice(0, 5).join(' | '));
  const figs = await p.evaluate(() => [...document.querySelectorAll('#pulse td.n')].map(td => { const r = td.getBoundingClientRect(); return r.right <= window.innerWidth && r.width > 0; }));
  check('E2: every pulse figure is on-screen', figs.length >= 9 && figs.every(Boolean), String(figs.length));
  check('E2: sticky Continue still fully visible with pulse open', await inViewport(p, '#actNext'));
  check('E2: phone pulse: market read before the figures', pulse.indexOf('MARKET READ') < pulse.indexOf('Price reductions'));
  await p.evaluate(() => document.querySelector('#pulse').scrollIntoView());
  await p.screenshot({ path: out + 'v08-pulse-390.png', fullPage: false });
  // Comparable pulse (full coverage) on the same phone must also fit.
  await p.click('#pasteAgain');
  await paste(p, TAYCAN.replace('$378,800', '$368,800').replace(/9 Vehicles/g, '9 Vehicles'));
  await p.waitForSelector('#stPool:not([hidden])');
  await p.setInputFiles('#snapFile', out + 'snapshot-taycan.json');
  await p.waitForSelector('#pulse:not([hidden])');
  check('E2: comparable pulse fits too', (await text(p, '#pulse')).includes('Active listings in this capture') && await noHScroll(p));
  check('E2: no page errors', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// ---------------------------------------------------------------- F. E200 real paste full loop (V0.7 regression)
{
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await p.click('#subjDemo');
  await next(p);
  await paste(p, E200);
  await p.waitForSelector('#stPool:not([hidden])');
  const S = await p.evaluate(() => { const s = window.__mpd.state; return { short: s.pool.shortlist, sold: s.listings.filter(l => l.sold).map(l => l.id), own: s.listings.filter(l => l.own).map(l => l.id), inc: s.inc }; });
  check('F: no sold listing shortlisted or ticked', S.sold.every(id => !S.short.includes(id) && !S.inc[id]));
  check('F: E200 Motorway stock never ticked', S.own.length >= 1 && S.own.every(id => !S.inc[id]));
  await next(p);
  await setVal(p, '#resale', '60000'); await setVal(p, '#recon', '2000'); await setVal(p, '#other', '1000'); await setVal(p, '#profit', '5000'); await setVal(p, '#offer', '50000');
  check('F: max = 60,000 − 2,000 − 1,000 − 5,000', (await text(p, '#maxAcq')) === '$52,000');
  check('F: explicit costs → no blank warning', await p.isHidden('#blankWarn'));
  check('F: GP at 50,000 starting offer', (await text(p, '#gp')) === '$7,000');
  await p.screenshot({ path: out + 'v08-desk-e200-1440.png', fullPage: true });
  await next(p);
  const dec = await text(p, '#decBody');
  check('F: Decision has 8 sections', ['01', '02', '03', '04', '05', '06', '07', '08'].every(n => dec.includes(n)) && dec.includes('Owner makes the final decision.'));
  check('F: no page errors', !p.errors.length, p.errors.join(' | '));
  await p.context().close();
}

// ---------------------------------------------------------------- H. Listing links: Ctrl+V with text/html → clickable titles; text-only → plain titles
{
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const { loadCore } = await import('./lib.mjs');
  const titles = loadCore().parseSgcm(TAYCAN, {}).listings.map(l => l.title);
  const html = titles.map((t, i) => { const u = `https://www.sgcarmart.com/used-cars/info/${slug(t)}-${1478212 + i}/?dl=${2469 + i}`; return `<a href="${u}"><img alt=""></a><a href="${u}">${t}</a><a href="https://www.sgcarmart.com/used-cars/listing?dl=${2469 + i}">dealer</a>`; }).join('');
  const pasteBoth = (page) => page.evaluate(([t, h]) => { const dt = new DataTransfer(); dt.setData('text/plain', t); dt.setData('text/html', h); document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })); }, [TAYCAN, html]);
  for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const p = await newPage(vp);
    const hits = []; p.on('request', r => { if (/sgcarmart/i.test(r.url())) hits.push(r.url()); });
    await p.goto(base + 'motorway-pricing-desk.html');
    await taycanSubject(p); await next(p);
    await pasteBoth(p); await p.waitForSelector('#stPool:not([hidden])');
    const tag = vp.width < 500 ? 'phone' : 'laptop';
    const sel = vp.width < 500 ? '#poolCards a.cname' : '#poolBody a.name';
    const a = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map(x => ({ href: x.getAttribute('href'), target: x.getAttribute('target'), rel: x.getAttribute('rel'), ext: x.querySelector('.ext')?.textContent })), sel);
    check(`H ${tag}: shortlist titles are links to the real /used-cars/info/ URLs`, a.length >= 4 && a.every(x => /^https:\/\/www\.sgcarmart\.com\/used-cars\/info\/porsche-taycan.*-\d+\/\?dl=\d+$/.test(x.href)), JSON.stringify(a[0]));
    check(`H ${tag}: new tab, noopener noreferrer, ↗ affordance`, a.every(x => x.target === '_blank' && x.rel === 'noopener noreferrer' && x.ext === '↗'));
    await next(p);
    const d = await p.evaluate((sel) => document.querySelectorAll(sel).length, vp.width < 500 ? '#mcards a.cname' : '#rows a.name');
    check(`H ${tag}: Comparison desk keeps the links`, d >= 3, String(d));
    check(`H ${tag}: snapshot carries the URLs`, await p.evaluate(() => window.__mpd.state.listings.every(l => /used-cars\/info\//.test(l.url || ''))));
    check(`H ${tag}: no request to SGCarMart was made`, hits.length === 0, hits.join(' '));
    if (vp.width < 500) check('H phone: linked card title still ≥ 12 px text, tap target is the whole title', await p.evaluate(() => { const a = document.querySelector('#mcards a.cname'); const r = a.getBoundingClientRect(); return parseFloat(getComputedStyle(a.querySelector('.ext')).fontSize) >= 12 && r.height >= 14 && r.width >= 100; }));
    await p.screenshot({ path: out + `v08-links-${vp.width}.png`, fullPage: false });
    check(`H ${tag}: no page errors`, !p.errors.length, p.errors.join(' | '));
    await p.context().close();
  }
  // Text-only paste (the other two paste paths) → plain titles, no anchors.
  const p = await newPage();
  await p.goto(base + 'motorway-pricing-desk.html');
  await taycanSubject(p); await next(p); await paste(p, TAYCAN); await p.waitForSelector('#stPool:not([hidden])');
  check('H: text-only paste → titles are plain text, no ↗', (await p.evaluate(() => document.querySelectorAll('#poolBody a.name, #poolBody .ext').length)) === 0 && (await p.evaluate(() => window.__mpd.state.listings.every(l => l.url === null))));
  await p.context().close();
}

// ---------------------------------------------------------------- G. No auto-scraping / backend
{
  const html = readFileSync(root + 'motorway-pricing-desk.html', 'utf8');
  check('G: no fetch/XHR/WebSocket/storage/timers-for-polling in the app', !/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|setInterval\(/.test(html));
  check('G: no sgcarmart URL requested by the app', !/https?:\/\/(www\.)?sgcarmart/i.test(html));
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed · screenshots in test-output/`);
process.exit(fail ? 1 : 0);
