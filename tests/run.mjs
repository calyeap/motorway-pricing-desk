// Unit + fixture acceptance tests. No test framework: node tests/run.mjs
// Loads the pure core (<script id="mpd-core">) straight out of the app HTML, so the tested code is the shipped code.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(root + 'motorway-pricing-desk.html', 'utf8');
const core = html.match(/<script id="mpd-core">([\s\S]*?)<\/script>/)[1];
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(core, ctx);
const M = ctx.module.exports;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, detail = '') => eq(name + (detail ? ` (${detail})` : ''), !!cond, true);

const AS_AT = new Date(2026, 8, 30); // fixture captured 30 Sep 2026

// ---------------------------------------------------------------- SGCarMart fixture
const fx = readFileSync(root + 'fixtures/sgcm-e200-avantgarde-ctrl-a.txt', 'utf8');
const P = M.parseSgcm(fx, { asAt: AS_AT });
const L = P.listings;
eq('sgcm: 100 listing blocks on page 1', L.length, 100);
eq('sgcm: header total 180 vehicles', P.header.total, 180);
eq('sgcm: search term read', P.header.search, 'mercedes-benz e200 avantgarde');

// Sold rule: only SGCarMart's explicit "sold" + "View Similar" status in the listing header.
const lines = fx.replace(/\r/g, '').split('\n');
let pairs = 0;
for (let i = 0; i < lines.length - 1; i++) if (lines[i].trim() === 'sold' && lines[i + 1].trim() === 'View Similar') pairs++;
eq('sgcm: sold count equals explicit header pairs', L.filter(l => l.sold).length, pairs);
eq('sgcm: 16 sold, 84 active', [P.stats.sold, P.stats.active], [16, 84]);
ok('sgcm: every sold listing has a "sold"-prefixed header title in the source', L.filter(l => l.sold).every(l => fx.includes('sold' + l.title)));
const soldWordInDesc = L.filter(l => !l.sold && /\bsold\b/i.test(l.desc));
ok('sgcm: listings whose description says "sold" are NOT marked sold', soldWordInDesc.length >= 2 && soldWordInDesc.every(l => !l.sold), `${soldWordInDesc.length} such listings`);
ok('sgcm: sold listings have no asking price', L.filter(l => l.sold).every(l => l.price === null && l.f.price.why === 'sold'));
ok('sgcm: every active listing has an asking price', L.filter(l => !l.sold).every(l => typeof l.price === 'number' && l.price > 0));

// Noise: the Toyota Alphard star ad and featured-dealer tiles are not listings.
ok('sgcm: Alphard ad is not a listing', !L.some(l => /Alphard/.test(l.title)));
ok('sgcm: Alphard ad is in the ignored blocks', P.ignored.some(g => /Alphard/.test(g.preview) && /Promoted/.test(g.kind)));
ok('sgcm: first block is navigation, last is footer', /navigation/i.test(P.ignored[0].kind) && P.ignored[P.ignored.length - 1].kind === 'Footer');
ok('sgcm: no listing title is page chrome', L.every(l => /^Mercedes-Benz /.test(l.title)));

// Field reading on known rows (exact values as read).
const first = L[0];
eq('sgcm: listing 1 fields', [first.title, first.price, first.dep, first.reg, first.coeM, first.km, first.owners, first.dealer, first.posted],
  ['Mercedes-Benz E-Class E200 Avantgarde (New 10-yr COE)', 168800, 16870, '2017-01-04', 120, 84373, 3, 'CARWAY', '2026-09-30']);
eq('sgcm: listing 1 renewed via title marker', [first.renewed, first.renewedSource], [true, '(New 10-yr COE)']);
eq('sgcm: listing 1 variant', first.variant, 'E200 Avantgarde');
const l2 = L[1];
eq('sgcm: listing 2 fields', [l2.price, l2.dep, l2.reg, l2.coeM, l2.km, l2.owners, l2.renewed], [61800, 21180, '2018-01-30', 15, 76900, 1, false]);
const na = L.find(l => l.price === 38000);
eq('sgcm: "N.A" fields stay null (not guessed)', [na.dep, na.km, na.coeM, na.owners], [null, null, null, 1]);
eq('sgcm: missing field status', [na.f.dep.status, na.f.km.status], ['missing', 'missing']);
const coeTill = L.filter(l => /COE till/.test(l.title));
ok('sgcm: both "(COE till mm/yyyy)" 2008 cars are renewed', coeTill.length === 2 && coeTill.every(l => l.renewed && l.reg.startsWith('2008')));
eq('sgcm: renewed count', L.filter(l => l.renewed).length, L.filter(l => l.renewedSource).length);
ok('sgcm: all 6 "(New 10-yr COE)" listings are renewed (title appears twice per block)', L.filter(l => /New 10-yr COE/.test(l.title)).length === 6 && L.filter(l => /New 10-yr COE/.test(l.title)).every(l => l.renewed));
eq('sgcm: 8 renewed in total', L.filter(l => l.renewed).length, 8);
eq('sgcm: mileage not stated on 24 listings (16 sold + 8 active)', [L.filter(l => l.km === null).length, L.filter(l => l.km === null && !l.sold).length], [24, 8]);
ok('sgcm: fuel type line is a field, not description', L.some(l => l.fuel === 'Petrol-Electric') && !L.some(l => /Fuel Type:/.test(l.desc)));
ok('sgcm: dealer names never leak into descriptions as "|"', !L.some(l => /(^| )\|( |$)/.test(l.desc)));
ok('sgcm: nothing needs input on the real fixture', P.stats.needsInput === 0);
ok('sgcm: unusual mileage is flagged, accepted as read', L.filter(l => l.f.km.status === 'unusual').every(l => typeof l.km === 'number'));

// Idempotent and CRLF/LF-agnostic.
eq('sgcm: LF-only paste gives same listings', JSON.stringify(M.parseSgcm(fx.replace(/\r/g, ''), { asAt: AS_AT }).listings), JSON.stringify(L));
eq('sgcm: empty paste → no listings', M.parseSgcm('', { asAt: AS_AT }).listings.length, 0);
eq('sgcm: random text → no listings', M.parseSgcm('hello\nworld\nCompare\n', { asAt: AS_AT }).listings.length, 0);

// Variant conflict path (synthetic, minimal): header title lines disagree → needs input, never guessed.
const conflictPaste = ['Mercedes-Benz E-Class E200 AMG Line', 'Premium Ad', 'Mercedes-Benz E-Class E200 Avantgarde', '$100,000', 'Instl. $1 /mth', '$20,000 /yr', '01-Jan-2020', '', '(3y 3m COE left)', '', '70,000 km', '1,991 cc', '2 Owners', 'shortlist', 'desc', 'Posted 30-Sep-2026', '', 'Compare'].join('\n');
const C = M.parseSgcm(conflictPaste, { asAt: AS_AT }).listings[0];
eq('sgcm: conflicting title lines → needs_input with both candidates', [C.status, C.variant, C.conflict.candidates.map(c => c.value)], ['needs_input', null, ['E200 Avantgarde', 'E200 AMG Line']]);

// ---------------------------------------------------------------- Shortlist on the real fixture (sample E200 subject)
const E200 = { make: 'Mercedes-Benz', model: 'E200 Avantgarde', reg: '2020-03-18', km: 72000, owners: 2, coeM: 41, renewed: false };
const pool = M.buildPool(E200, L);
const shortL = pool.shortlist.map(id => L.find(l => l.id === id));
ok('pool: shortlist has 1–10 market rows plus Motorway-stock context rows', shortL.filter(l => !l.own).length >= 1 && shortL.filter(l => !l.own).length <= 10, `${shortL.length}`);
ok('pool: Motorway stock in the shortlist is context only (never ticked by default)', shortL.filter(l => l.own).every(l => !M.defaultInclude(l)));
ok('pool: no sold listing in the shortlist', shortL.every(l => !l.sold));
ok('pool: no sold listing is plausible either', L.filter(l => l.sold).every(l => pool.tier[l.id] === 'aside'));
ok('pool: CLE200 is set aside as a different model', L.filter(l => /CLE200/.test(l.title)).every(l => pool.tier[l.id] === 'aside' && pool.reason[l.id] === 'Different model'));
ok('pool: non-reference shortlist rows are original COE ≥ 24 mo, reg within 18 mo',
  shortL.filter(l => !pool.refs.includes(l.id)).every(l => !l.renewed && l.coeM >= 24 && Math.abs(M.monthsBetween(M.dateOf(l.reg), M.dateOf(E200.reg))) <= 18));
ok('pool: at most 2 reference rows, all with a different COE situation', pool.refs.length <= 2 && pool.refs.every(id => M.coeDiffers(L.find(l => l.id === id))));
eq('pool: deterministic', M.buildPool(E200, L).shortlist, pool.shortlist);

// ---------------------------------------------------------------- V0.6 maths regression (V0.6 sample data)
const DEMO = [
  { id: 1, reg: '2019-12-12', price: 106800, dep: 25060, km: 78000, owners: 2, coeM: 38, renewed: false },
  { id: 2, reg: '2020-02-28', price: 113800, dep: 25830, km: 61000, owners: 1, coeM: 40, renewed: false },
  { id: 3, reg: '2020-07-15', price: 137800, dep: 28890, km: 52000, owners: 1, coeM: 45, renewed: false },
  { id: 4, reg: '2020-05-09', price: 107500, dep: 22400, km: 96000, owners: 3, coeM: 43, renewed: false },
  { id: 5, reg: '2020-03-20', price: 114500, dep: 25440, km: 70000, owners: 2, coeM: 41, renewed: false },
  { id: 6, reg: '2020-11-06', price: 138800, dep: 26710, km: 44000, owners: 1, coeM: 49, renewed: false },
  { id: 7, reg: '2017-08-18', price: 50800, dep: 26360, km: 118000, owners: 2, coeM: 10, renewed: false },
  { id: 8, reg: '2016-06-03', price: 139800, dep: 14460, km: 139000, owners: 3, coeM: 116, renewed: true },
].map(d => ({ ...d, title: 'Mercedes-Benz E-Class E200 x', status: 'ok', sold: false }));
const ticked = DEMO.filter(l => !M.coeDiffers(l)); // V0.6 defaultInc()
const ev = M.evidence(ticked);
eq('v0.6: default ticks = listings 1–6', ticked.map(l => l.id), [1, 2, 3, 4, 5, 6]);
eq('v0.6: evidence (n, low, median, high, median dep)', [ev.n, ev.low, ev.med, ev.high, ev.depMed], [6, 106800, 114150, 138800, 25635]);
const econ = M.economics({ resale: 112000, recon: 3500, other: 1500, profit: 8000, offer: 95000 });
eq('v0.6: max acquisition + projected GP', [econ.max, econ.gp], [99000, 12000]);
eq('v0.6: blanks count as $0 and are listed', M.economics({ resale: 112000, recon: null, other: 1500, profit: null, offer: null }), { max: 110500, gp: null, r0: 0, o0: 1500, p0: 0, blanks: ['reconditioning', 'target profit buffer'], provisional: true });
eq('v0.6: no resale → no max', M.economics({ resale: null, recon: 1, other: 1, profit: 1, offer: 1 }).max, null);
eq('evidence: unpriced (sold) rows are excluded from figures', M.evidence([...ticked, { price: null, dep: null, renewed: false, coeM: null }]).noPrice, 1);
const dpool = M.buildPool(E200, DEMO);
eq('pool on V0.6 sample = V0.6 set (6 + 2 references)', [dpool.shortlist.slice().sort(), dpool.refs.slice().sort()], [[1, 2, 3, 4, 5, 6, 7, 8], [7, 8]]);

// ---------------------------------------------------------------- LTA parser (text lines)
// Two-column layout; skipped labels carry "[REDACTED]" so we can prove their values never surface. No real or invented PII.
const twoCol = [
  'Vehicle Registration Details',
  'Vehicle No.\t[REDACTED]\tVehicle Make\tPORSCHE',
  'Owner Name\t[REDACTED]\tVehicle Model\tTAYCAN 4S 4+1',
  'Chassis No.\t[REDACTED]\tPropellant\tElectric',
  'Registered Address\t[REDACTED]',
  'Original Registration Date: 29 Apr 2022\tCOE Expiry Date: 28 Apr 2032',
  'Open Market Value\t$136,610.00\tActual ARF Paid\t$182,898.00',
  'No. of Transfers\t2',
];
const T = M.parseLta(twoCol);
eq('lta: two-column values', ['make', 'model', 'propellant', 'regDate', 'coeExpiry', 'omv', 'arf', 'transfers'].map(k => T.fields[k].value),
  ['PORSCHE', 'TAYCAN 4S 4+1', 'Electric', '2022-04-29', '2032-04-28', 136610, 182898, 2]);
ok('lta: skipped-label values never appear anywhere in the output', !JSON.stringify(T).includes('REDACTED'));
eq('lta: skipped labels are counted, not read', T.skippedLabels, 4);
eq('lta: missing field → null + missing', [T.fields.colour.value, T.fields.colour.status], [null, 'missing']);
const conf = M.parseLta(['Open Market Value $136,610', 'Open Market Value $136,000']);
eq('lta: two different values → conflict with candidates, no pick', [conf.fields.omv.status, conf.fields.omv.value, conf.fields.omv.candidates.length], ['conflict', null, 2]);
eq('lta: label above value layout', M.parseLta(['COE Expiry Date', '28 Apr 2032']).fields.coeExpiry.value, '2032-04-28');
eq('lta: NRIC-shaped text is never accepted as a text field', M.parseLta(['Vehicle Model\tS1234567A']).fields.model.value, null);
eq('lta: "Secondary Colour" does not fill colour', M.parseLta(['Secondary Colour\tBlack']).fields.colour.value, null);

// ---------------------------------------------------------------- LTA synthetic PDF acceptance fixture (via pdf.js, as in the browser)
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(readFileSync(root + 'fixtures/lta-taycan-4s-synthetic.pdf'));
const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
const items = [];
for (let n = 1; n <= doc.numPages; n++) {
  const pg = await doc.getPage(n);
  (await pg.getTextContent()).items.forEach(it => items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: n }));
}
const R = M.parseLta(M.itemsToLines(items));
const want = { make: 'PORSCHE', model: 'TAYCAN 4S 4+1', yearMfg: 2021, regDate: '2022-04-29', transfers: 2, propellant: 'Electric', omv: 136610, arf: 182898, coeExpiry: '2032-04-28', qp: 80210, parf: 91449 };
eq('lta pdf: all 11 supplied values read exactly', Object.fromEntries(Object.keys(want).map(k => [k, R.fields[k].value])), want);
ok('lta pdf: every read value is status exact with a source', Object.keys(want).every(k => R.fields[k].status === 'exact' && R.fields[k].source));
eq('lta pdf: fields not on the document stay null', ['colour', 'coeCat', 'parfElig'].map(k => R.fields[k].value), [null, null, null]);
const subj = M.subjectFrom(R.fields, 35000, AS_AT);
eq('subject: Taycan from PDF + 35,000 km', [subj.name, subj.km, subj.owners, subj.coeM, subj.renewed, subj.reg],
  ['Porsche Taycan 4S 4+1', 35000, 3, 66, false, '2022-04-29']);
const tpool = M.buildPool(subj, L);
ok('subject: Taycan vs the E200 paste → nothing shortlisted, all set aside', tpool.shortlist.length === 0 && L.every(l => tpool.tier[l.id] === 'aside'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
