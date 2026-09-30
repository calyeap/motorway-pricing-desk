// V0.8 acceptance tests (core only; browser flow is in e2e.mjs). node tests/v08.mjs
import { loadCore, suite, fixture, pdfLines, AS_AT, root } from './lib.mjs';
import { readFileSync } from 'node:fs';

const M = loadCore();
const t = suite();
const byId = (L, id) => L.find(l => l.id === id);
const TAYCAN = { make: 'Porsche', model: 'Taycan 4S 4+1', reg: '2022-04-29', km: 35000, owners: 3, transfers: 2, coeM: 66, renewed: false };
const E200 = { make: 'Mercedes-Benz', model: 'E200 Avantgarde', reg: '2020-03-18', km: 72000, owners: 2, coeM: 41, renewed: false };

// ================================================================ G. Taycan fixture
const tx = fixture('sgcm-taycan-4s-ctrl-a.txt');
const TP = M.parseSgcm(tx, { asAt: AS_AT });
const TL = TP.listings;
t.eq('taycan: 9 listings detected (header says 9)', [TL.length, TP.header.total], [9, 9]);
t.eq('taycan: explicit sold = listings 6–9, active = 1–5', [TL.filter(l => l.sold).map(l => l.id), TL.filter(l => !l.sold).map(l => l.id)], [[6, 7, 8, 9], [1, 2, 3, 4, 5]]);
t.ok('taycan: Voxy star ad and "Suggested For You" are not listings', !TL.some(l => /Voxy|A180|XPENG/.test(l.title)));
t.eq('taycan: listing 5 read exactly', (l => [l.price, l.dep, l.reg, l.km, l.owners, l.coeM, l.dealer])(byId(TL, 5)), [342000, 44900, '2022-04-29', 29999, 3, 66, 'Motor-Way Credit Pte Ltd']);

// ================================================================ A1. Own inventory
t.eq('own: only the Motor-Way listing is Motorway stock', TL.filter(l => l.own).map(l => l.id), [5]);
t.ok('own: dealer-name variants match', ['Motor-Way Credit Pte Ltd', 'Motorway Pte Ltd', 'MOTOR WAY CREDIT', 'motor-way'].every(d => M.isOwnStock(d)));
t.ok('own: non-Motorway dealers do not match', ['1 Auto Cars Pte Ltd', 'Car Craft Pte Ltd', 'Highway Motors', null, ''].every(d => !M.isOwnStock(d)));
const EP = M.parseSgcm(fixture('sgcm-e200-avantgarde-ctrl-a.txt'), { asAt: AS_AT });
const EL = EP.listings;
t.ok('own: E200 Motor-Way listing detected', EL.some(l => l.own && /motor-?way/i.test(l.dealer)));

// ================================================================ A3. Variant classes
t.eq('variant: seat configuration 4+1 is dropped from variant words', M.familyKey({ make: 'PORSCHE', model: 'TAYCAN 4S 4+1' }).variant, ['4s']);
const TPool = M.buildPool(TAYCAN, TL);
t.eq('variant: classes on Taycan (exact / adjacent / different)', [1, 2, 3, 4, 5].map(id => byId(TL, id).vclass), ['adjacent', 'adjacent', 'different', 'adjacent', 'exact']);
t.eq('variant: related-variant label names the extra spec and says not the same spec', byId(TL, 1).vlabel, 'Related variant — Performance Battery Plus · not the same spec');
t.eq('variant: Sunroof alone is adjacent, not equal', M.variantClass('Porsche Taycan Electric 4S Sunroof', M.familyKey(TAYCAN)).cls, 'adjacent');
t.eq('variant: Cross Turismo is a different body style', byId(TL, 3).vlabel, 'Different body style — Cross Turismo');
t.ok('variant: GTS and Turbo are not exact for a 4S', ['Porsche Taycan GTS', 'Porsche Taycan Turbo S', 'Porsche Taycan Turbo'].every(x => M.variantClass(x, M.familyKey(TAYCAN)).cls !== 'exact'));
t.eq('variant: Cross Turismo set aside with reason', [TPool.tier[3], TPool.reason[3]], ['aside', 'Different body style — Cross Turismo']);
t.eq('variant: E200 "Avantgarde" exact, Mild Hybrid / Sunroof adjacent', ['Mercedes-Benz E-Class E200 Avantgarde', 'Mercedes-Benz E-Class E200 Mild Hybrid Avantgarde', 'Mercedes-Benz E-Class E200 Avantgarde Sunroof'].map(x => M.variantClass(x, M.familyKey(E200)).cls), ['exact', 'adjacent', 'adjacent']);

// ================================================================ A1. Possible same car + default ticks
t.eq('same car: listing 5 flagged as possible same car', TL.filter(l => l.possibleSame).map(l => l.id), [5]);
t.ok('own: Motorway stock is visible in the shortlist for context', TPool.tier[5] === 'short');
t.eq('own: Motorway stock unticked by default', M.defaultInclude(byId(TL, 5)), false);
t.ok('sold: never ticked by default', TL.filter(l => l.sold).every(l => !M.defaultInclude(l)));
t.ok('sold: never shortlisted', TL.filter(l => l.sold).every(l => TPool.tier[l.id] === 'aside'));

// ================================================================ A2. Thin market
const tick = TPool.shortlist.map(id => byId(TL, id)).filter(l => M.defaultInclude(l));
const mk = M.market(tick, TL);
t.eq('thin: default ticks = the 3 adjacent PB+ listings', tick.map(l => l.id).sort(), [1, 2, 4]);
t.eq('thin: evidence split', [mk.exactIndependent, mk.adjacent, mk.ownTicked, mk.ownParsed, mk.soldParsed], [0, 3, 0, 1, 4]);
t.ok('thin: THIN MARKET flagged despite 3 comps', mk.thin === true);
t.ok('thin: reasons are visible and specific', mk.reasons.some(r => /0 exact-variant independent active/.test(r)) && mk.reasons.some(r => /related variants — not the same spec/.test(r)) && mk.reasons.some(r => /Motorway stock/.test(r)));
const withOwn = M.market([...tick, byId(TL, 5)], TL);
t.ok('own: ticking Motorway stock never counts as independent', withOwn.exactIndependent === 0 && withOwn.ownTicked === 1);
t.ok('own: excluded from independent median by default', M.evidence(tick).med === 378800 && !tick.includes(byId(TL, 5)));
t.ok('sold: sold rows excluded from active evidence', M.market([...tick, byId(TL, 7)], TL).evidence.n === 3);

// V0.6 sample: 3 exact Avantgarde → not thin; maths unchanged
const DEMO = [
  ['E200 Avantgarde', 106800, 25060, '2019-12-12', 78000, 2, 38], ['E200 Exclusive', 113800, 25830, '2020-02-28', 61000, 1, 40],
  ['E200 AMG Line', 137800, 28890, '2020-07-15', 52000, 1, 45], ['E200 Avantgarde', 107500, 22400, '2020-05-09', 96000, 3, 43],
  ['E200 Avantgarde', 114500, 25440, '2020-03-20', 70000, 2, 41], ['E200 AMG Line', 138800, 26710, '2020-11-06', 44000, 1, 49],
].map(([v, price, dep, reg, km, owners, coeM], i) => ({ id: i + 1, title: 'Mercedes-Benz E-Class ' + v, price, dep, reg, km, owners, coeM, renewed: false, sold: false, status: 'ok', dealer: null }));
M.buildPool(E200, DEMO);
const dm = M.market(DEMO, DEMO);
t.eq('v0.6 sample: 3 exact Avantgarde, 3 adjacent, not thin, median unchanged', [dm.exactIndependent, dm.adjacent, dm.thin, dm.evidence.med], [3, 3, false, 114150]);

// ================================================================ A4/A5. Owners derived, COE inferred
const subj = M.subjectFrom({ make: M.F('PORSCHE', 's', 'exact'), model: M.F('TAYCAN 4S 4+1', 's', 'exact'), transfers: M.F(2, 's', 'exact'), regDate: M.F('2022-04-29', 's', 'exact'), coeExpiry: M.F('2032-04-28', 's', 'exact') }, 35000, AS_AT);
t.eq('owners: transfers stay source truth, owners marked derived', [subj.transfers, subj.owners, subj.ownersDerived], [2, 3, true]);
t.eq('coe: original status marked inferred', [subj.renewed, subj.coeStatusInferred], [false, true]);

// ================================================================ A6. Blank economics
const e1 = M.economics({ resale: 350000, recon: null, other: null, profit: null, offer: null });
t.eq('blank costs: maths unchanged (blank = $0) but flagged provisional', [e1.max, e1.provisional, e1.blanks.length], [350000, true, 3]);
t.eq('blank costs: explicit zeros are not provisional', M.economics({ resale: 350000, recon: 0, other: 0, profit: 0, offer: null }).provisional, false);
t.eq('maths: V0.6 figures unchanged', (e => [e.max, e.gp])(M.economics({ resale: 112000, recon: 3500, other: 1500, profit: 8000, offer: 95000 })), [99000, 12000]);

// ================================================================ A7. LTA privacy hardening (fake PII only)
const bleed = [
  "Vehicle Model  TAYCAN 4S 4+1  Registered Owner's Name  JOHN DOE",
  'Colour  WHITE  Salutation  MR JOHN DOE',
  'Vehicle Make',
  'JOHN DOE',
  'Propellant\tElectric JOHN',
];
const B = M.parseLta(bleed);
t.eq('privacy: first cell only for model', B.fields.model.value, 'TAYCAN 4S 4+1');
t.eq('privacy: colour stops before neighbouring label', B.fields.colour.value, 'WHITE');
t.eq('privacy: text value never taken from the next line', B.fields.make.value, null);
t.eq('privacy: propellant must be a known propellant', B.fields.propellant.value, null);
t.ok('privacy: no fake PII anywhere in parser output', !/JOHN|DOE|\bMR\b/.test(JSON.stringify(B)));
t.eq('privacy: make must be a known make', M.parseLta(['Vehicle Make\tJOHN DOE']).fields.make.value, null);

const FL = M.parseLta(await pdfLines(M, 'lta-layout-fake-pii.pdf'));
t.eq('privacy pdf: vehicle fields read from dense layout', ['make', 'model', 'colour', 'propellant', 'regDate', 'coeExpiry', 'transfers', 'omv', 'arf', 'roadTaxExpiry'].map(k => FL.fields[k].value),
  ['PORSCHE', 'TAYCAN 4S 4+1', 'WHITE', 'Electric', '2022-04-29', '2032-04-28', 2, 136610, 182898, '2027-04-28']);
const FJ = JSON.stringify(FL);
t.ok('privacy pdf: no fake personal value leaks into output', !['JOHN', 'DOE', 'S0000000A', 'FAKE', 'JANE', 'ROE', '1980', 'SXX1234Z', 'WP0ZZZ', '1234567890', '9000'].some(s => FJ.includes(s)), FJ.match(/JOHN|DOE|S0000000A|FAKE|JANE|ROE|1980|SXX1234Z|WP0ZZZ|1234567890|9000/)?.[0] || '');
t.ok('privacy: parser result carries no raw lines', !('lines' in FL) && !('raw' in FL));

// Synthetic Taycan acceptance PDF still reads all 11 values
const SR = M.parseLta(await pdfLines(M, 'lta-taycan-4s-synthetic.pdf'));
t.eq('lta pdf: Taycan synthetic values unchanged', ['make', 'model', 'yearMfg', 'regDate', 'transfers', 'propellant', 'omv', 'arf', 'coeExpiry', 'qp', 'parf'].map(k => SR.fields[k].value),
  ['PORSCHE', 'TAYCAN 4S 4+1', 2021, '2022-04-29', 2, 'Electric', 136610, 182898, '2032-04-28', 80210, 91449]);

// ================================================================ 13. Road tax (optional, display only)
t.eq('road tax: expiry parsed when present', M.parseLta(['Road Tax Expiry Date\t28 Apr 2027']).fields.roadTaxExpiry.value, '2027-04-28');

// ================================================================ D. Car story (source-backed, verbatim)
const st = M.carStory(byId(TL, 5));
t.ok('story: warranty mention quoted from source', st.mentions.some(m => m.tag === 'mentions warranty' && /Warranty/i.test(m.quote)));
t.ok('story: labels say "mentions", never "has"', st.mentions.every(m => /^mentions /.test(m.tag)));
t.ok('story: import used shown as a source fact', M.carStory(byId(TL, 9)).facts.includes('Import Used'));
t.eq('story: original registration quoted for import used', M.carStory(byId(TL, 9)).importOrigReg, '2021-09-30');

// ================================================================ F. Snapshots, identity, diff, Market Pulse
const snap = M.snapshotFrom(TP, { savedAt: '2026-09-30T09:00:00.000Z', asAt: AS_AT });
t.eq('snapshot: metadata', [snap.kind, snap.search, snap.sgcmTotal, snap.captured, snap.sort], ['mpd-market-snapshot', 'porsche taycan 4s', 9, 9, 'Any Status, Date Posted (Newest)']);
const SJ = JSON.stringify(snap);
t.ok('snapshot: holds no subject / LTA data', !/subject|lta|omv|arf|transfers|35000|coeExpiry/i.test(SJ));
t.ok('snapshot: identity never includes price', snap.listings.every(l => !String(l.key).includes('342') && !String(l.key).includes('378')));
t.eq('snapshot: identity stable across a price change', M.identity({ ...byId(TL, 1), price: 1 }), M.identity(byId(TL, 1)));

// Build a "today" paste from the fixture: listing 1 −$10k, listing 4 +$5k, listing 2 gone, one new listing, listing 5 now sold.
let today = tx.replace('$378,800', '$368,800').replace('$356,888', '$361,888');
today = today.replace(/Porsche Taycan Electric 4S Performance Battery Plus\r?\nPorsche Taycan Electric 4S Performance Battery Plus\r?\n\$458,000[\s\S]*?Compare\r?\n/, '');
today = today.replace('Compare\r\nPorsche Taycan Cross Turismo Electric 4S Sunroof', 'Compare\r\nPorsche Taycan Electric 4S\r\nPorsche Taycan Electric 4S\r\n$329,800\r\nInstl. $4,000 /mth\r\n$43,000 /yr\r\n15-Jun-2022\r\n\r\n(5y 8m COE left)\r\n\r\n41,000 km\r\n-\r\n2 Owners\r\nshortlist\r\nFuel Type: Electric\r\nNew listing.\r\nPosted 30-Sep-2026\r\n\r\nCompare\r\nPorsche Taycan Cross Turismo Electric 4S Sunroof');
today = today.replace('Porsche Taycan Electric 4S\r\nPremium Ad\r\nPorsche Taycan Electric 4S\r\n$342,000', 'soldPorsche Taycan Electric 4S\r\nPremium Ad\r\nPorsche Taycan Electric 4S\r\nsold\r\nView Similar');
const TP2 = M.parseSgcm(today, { asAt: AS_AT });
t.eq('diff setup: today paste parsed', [TP2.listings.length, TP2.listings.filter(l => l.sold).length], [9, 5]);
const snap2 = M.snapshotFrom(TP2, { savedAt: '2026-10-07T09:00:00.000Z', asAt: AS_AT });
const D = M.diffSnapshots(snap, snap2);
t.ok('diff: comparable (same search, sort, full coverage)', D.comparable === true, D.warnings.join('; '));
t.eq('diff: price decrease', D.priceDown.map(x => x.cur.price), [368800]);
t.eq('diff: price increase', D.priceUp.map(x => x.cur.price), [361888]);
t.eq('diff: new listing', D.added.map(x => x.price), [329800]);
t.eq('diff: removed listing is NO LONGER LISTED, not sold', [D.noLongerListed.map(x => x.price), D.noLongerListed.every(x => !x.sold)], [[458000], true]);
t.eq('diff: explicit sold status only → sold', D.nowSold.map(x => x.cur.title), ['Porsche Taycan Electric 4S']);
t.ok('diff: sold count never includes disappeared listings', D.nowSold.length === 1);
t.eq('diff: active captured count', [D.activeBefore, D.activeAfter], [5, 4]);
t.ok('diff: median asking movement reported', D.medianBefore !== null && D.medianAfter !== null);
const R = M.marketRead(D);
t.ok('pulse: read is deterministic text with reasons', typeof R.read === 'string' && R.why.length > 0);
t.ok('pulse: median movement caveated when the captured set changed', R.why.some(w => /which listings are captured/.test(w)));
t.ok('pulse: never claims demand or transactions', !/demand|transaction|sales volume|sold/i.test(R.read + R.why.join(' ')));

// Coverage mismatch: E200 page 1 of 180 → partial; absences must not be classified as removals
const eSnapA = M.snapshotFrom(EP, { savedAt: '2026-09-30T09:00:00.000Z', asAt: AS_AT });
const cut = { ...eSnapA, listings: eSnapA.listings.slice(5), captured: eSnapA.captured - 5 };
const DE = M.diffSnapshots(eSnapA, cut);
t.ok('coverage: partial capture → not comparable, loud warning', DE.comparable === false && DE.warnings.some(w => /coverage/i.test(w)));
t.eq('coverage: absences are "not in this capture", not "no longer listed"', [DE.noLongerListed.length, DE.notCaptured.length], [0, 5]);
t.ok('coverage: different search term warns', M.diffSnapshots(snap, eSnapA).warnings.some(w => /search/i.test(w)));
t.eq('pulse: not comparable → read says so', M.marketRead(DE).read, 'Not comparable — capture coverage differs');

// Ambiguous identity → match needs review, never guessed
const twin = { ...snap, listings: [...snap.listings, { ...snap.listings[0] }], captured: 10, sgcmTotal: 10 };
const DA = M.diffSnapshots(twin, snap);
t.ok('identity: duplicate keys → "match needs review"', DA.needsReview.length >= 1);

// Own stock kept out of market pulse medians
t.ok('pulse: Motorway stock excluded from pulse medians', D.ownExcluded >= 1);

// ================================================================ H. Dealer-validated logic (Vendi): owners, related variants, OMV, pace, buffer
const APP = readFileSync(root + 'motorway-pricing-desk.html', 'utf8');
t.ok('owners: transfers + 1 is a dealer-confirmed rule, no "not yet confirmed" wording left', /dealer-confirmed rule/.test(APP) && !/not yet confirmed|to be confirmed by Motorway/.test(APP));
t.ok('owners: label stays "(derived)"', /Owners \(derived\)/.test(APP));
t.ok('variant: OMV never changes the class (same OMV as the subject is still related)', M.variantClass('Porsche Taycan Electric 4S Performance Battery Plus', M.familyKey({ ...TAYCAN, omv: 136610 })).cls === 'adjacent');
t.ok('variant: no asking-price ratio rule — class comes from the title only', M.variantClass('Porsche Taycan Electric 4S', M.familyKey(TAYCAN)).cls === 'exact' && !/0\.9|1\.1|10 ?%/.test(String(M.variantClass)));
t.eq('pace: SGCarMart Posted date is read for every Taycan listing', TL.map(l => l.posted), ['2026-09-28', '2026-09-25', '2026-09-24', '2026-09-22', '2026-09-17', '2026-08-21', '2026-08-04', '2026-07-18', '2026-07-13']);
t.ok('pace: Posted is shown as "days ago", never as time on market', /Posted .*days ago/.test(APP) && !/time on market|days on market|days listed/i.test(APP.replace(/not true time on market/g, '')));
t.ok('pulse: active count is labelled "in this capture", never "cars sitting in the market"', /Active listings in this capture/.test(APP) && !/sitting in the market/i.test(APP));
t.ok('pulse: price cuts are seller pressure, not low-demand proof; gone ≠ sold', /Price cuts show seller pressure, not proof of low demand/.test(APP) && /Gone ≠ sold unless SGCarMart marks it sold/.test(APP));
t.ok('pulse: no numeric demand score in the read', !/score/i.test(JSON.stringify(R)) && Object.keys(R).every(k => k === 'read' || k === 'why'));
t.ok('target: label is "Target gross profit" (dollar amount)', /Target gross profit/.test(APP) && !/Target profit buffer|Target margin/.test(APP));
t.ok('buffer: helper says the desk never changes the maximum', /Use a bigger target for a slower-moving car\. The desk never changes the maximum for you\./.test(APP));
t.ok('buffer: softer → larger buffer, mixed → review holding risk (text only)', /softer asking evidence — consider a larger target gross profit/.test(APP) && /mixed evidence — review holding risk before setting your target gross profit/.test(APP));
t.eq('buffer: economics() ignores market pulse (same inputs → same max, no pulse argument)', [M.economics({ resale: 330000, recon: null, other: null, profit: 5000, offer: null }).max, M.economics.length], [325000, 1]);
t.ok('omv: caption says context only, never a valuation basis', /\(context only · not used in pricing maths\)/.test(APP) && /' · context only<\/div>'/.test(APP) && !/factory spec/i.test(APP));

// ================================================================ I. Listing links from clipboard HTML (order + title agreement; never fabricated)
// Synthetic clipboard HTML in SGCarMart's shape: per listing an image anchor (no text), a title anchor and a repeated
// title anchor — all the same /used-cars/info/ URL — plus dealer links (/used-cars/listing?dl=) and a promo card for another car.
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const infoUrl = (t, id, dl) => `https://www.sgcarmart.com/used-cars/info/${slug(t)}-${id}/?dl=${dl}`;
const clipHtml = (titles, opt = {}) => titles.map((t, i) => {
  const u = infoUrl(t, 1478212 + i, 2469 + i), dl = `https://www.sgcarmart.com/used-cars/listing?dl=${2469 + i}`;
  const card = `<div><a href="${u}"><img alt="${t}"></a><a href="${u}"><span>${t}</span></a><a href="${dl}">Dealer</a><a href="${u}">${t}</a></div>`;
  return (opt.promoAt === i ? `<div class="promo"><a href="${infoUrl('Toyota Voxy 2.0A', 1600000, 9000)}">Toyota Voxy 2.0A</a></div>` : '') + card;
}).join('\n');
const tTitles = TL.map(l => l.title);
const html = clipHtml(tTitles, { promoAt: 3 });
const links = M.listingLinks(html);
t.eq('links: duplicate anchors collapse to one entry per listing, dealer links excluded', [links.length, links.filter(l => /listing\?dl=/.test(l.href)).length], [tTitles.length + 1, 0]);
t.eq('links: text comes from the first non-empty anchor (image anchor has none)', links[0].text, tTitles[0]);
t.eq('links: href kept exactly as read (dl query included, nothing rebuilt)', links[0].href, infoUrl(tTitles[0], 1478212, 2469));
const TLk = M.parseSgcm(tx, { asAt: AS_AT, links }).listings;
t.eq('links: every Taycan listing gets its own URL in document order; the Voxy promo is ignored', TLk.map(l => l.url), tTitles.map((tt, i) => infoUrl(tt, 1478212 + i, 2469 + i)));
t.ok('links: sold listings keep their URL too', TLk.filter(l => l.sold).every(l => l.url));
// E200: 20 listings on the page, most with the identical title. Exact one-to-one alignment still links each to its own URL.
const eTitles = EL.map(l => l.title);
t.ok('links: E200 page really has repeated identical titles', new Set(eTitles).size < eTitles.length);
const ELk = M.parseSgcm(fixture('sgcm-e200-avantgarde-ctrl-a.txt'), { asAt: AS_AT, links: M.listingLinks(clipHtml(eTitles)) }).listings;
t.ok('links: identical E200 titles → each listing linked in order, all URLs distinct', ELk.every((l, i) => l.url === infoUrl(eTitles[i], 1478212 + i, 2469 + i)) && new Set(ELk.map(l => l.url)).size === ELk.length);
// Counts diverge (one title anchor missing) → repeated titles become ambiguous → no link; only titles unique on both sides link.
const eLinksShort = M.listingLinks(clipHtml(eTitles)).filter((_, i) => i !== 1);
const ELm = M.parseSgcm(fixture('sgcm-e200-avantgarde-ctrl-a.txt'), { asAt: AS_AT, links: eLinksShort }).listings;
const count = {}; eTitles.forEach(x => { count[x] = (count[x] || 0) + 1; });
t.ok('links: mismatch → repeated titles get no link (never guessed)', ELm.filter(l => count[l.title] > 1).every(l => l.url === null));
t.ok('links: mismatch → a title unique on both sides still links; nothing else does', ELm.every(l => (count[l.title] === 1 && eLinksShort.filter(a => a.text === l.title).length === 1) ? l.url !== null : l.url === null));
// Extra anchor carrying a listing title (promo for the same car) → same ambiguity rule.
const extra = M.listingLinks(clipHtml(tTitles) + `<a href="${infoUrl(tTitles[0], 1999999, 1)}">${tTitles[0]}</a>`);
const TLx = M.parseSgcm(tx, { asAt: AS_AT, links: extra }).listings;
t.ok('links: extra same-title anchor → that title unlinked, unique titles still linked', TLx[0].url === null && TLx.filter(l => tTitles.filter(x => x === l.title).length === 1 && l.title !== tTitles[0]).every(l => l.url !== null));
// No HTML on the clipboard (button paste, textarea, older browsers) → plain titles, nothing invented.
t.ok('links: no clipboard HTML → url null on every listing', TL.every(l => l.url === null) && M.parseSgcm(tx, { asAt: AS_AT, links: [] }).listings.every(l => l.url === null));
t.ok('links: only /used-cars/info/ URLs are ever kept', M.listingLinks('<a href="https://www.sgcarmart.com/used-cars/listing?dl=1">x</a><a href="https://evil.example/used-cars/info/x-1/">x</a><a href="/used-cars/info/x-2/">rel</a>').length === 0);
// Snapshot round-trip keeps the URL; identity stays price-free and URL-free.
const snapK = JSON.parse(JSON.stringify(M.snapshotFrom({ header: TP.header, listings: TLk }, { savedAt: '2026-09-30T09:00:00.000Z', asAt: AS_AT })));
t.eq('links: snapshot keeps each listing URL', snapK.listings.map(l => l.url), TLk.map(l => l.url));
t.ok('links: snapshot identity unchanged (no URL, no price)', snapK.listings.every(l => l.key === M.identity(l) && !/sgcarmart|info\//.test(l.key)));
t.ok('links: snapshot without URLs still loads (url null)', JSON.parse(JSON.stringify(snap)).listings.every(l => l.url === null || l.url === undefined));

// ================================================================ J. Real LTA layout (openhtmltopdf): values below labels, combined MAKE/MODEL
// Shape taken from the sanitised diagnostic of Vendi's document: values one or two lines under their label, no Make field,
// model as "PORSCHE/TAYCAN 4S", two-column rows, personal labels nearby. Fake personal values only.
const REAL = [
  'Vehicle Registration Details',
  'Vehicle Model', 'Vehicle particulars', 'PORSCHE/TAYCAN 4S',            // value two lines below, filler line between
  'Vehicle No.\tOwner Name', 'SXX1234Z\tJOHN DOE',                          // personal labels + values
  'Propellant', 'Electric',                                                 // one line below
  'Original Registration Date\tNo. of Transfers', '29 Apr 2022\t2',        // two columns, values below in the same columns
  'Year of Manufacture', '2021',
  'Primary Colour', 'Grey',
  'Open Market Value', 'as at first registration', '$136,610.00',          // two lines below
  'Actual ARF Paid', '$182,898.00',
  'COE Expiry Date', '28 Apr 2032 11:59 PM',                               // not a plain date → stays missing
  'COE Category', 'Category B (Cars above 1600cc or 130bhp)',              // descriptive row → stays missing
  'QP Paid', '', '$80,210.00',
  'PARF Eligibility', 'Yes',
  'Minimum PARF Benefit', '$91,449.00',
  'Registered Address', '1 FAKE STREET #01-01', 'Singapore 123456',
];
const RJ = M.parseLta(REAL);
const rv = (k) => RJ.fields[k].value;
t.eq('real layout: fields expected from this document all parse', ['omv', 'arf', 'qp', 'parf', 'parfElig', 'transfers', 'regDate', 'yearMfg', 'propellant', 'colour'].map(rv), [136610, 182898, 80210, 91449, 'Yes', 2, '2022-04-29', 2021, 'Electric', 'Grey']);
t.eq('real layout: combined PORSCHE/TAYCAN 4S → Make derived, Model split', [rv('make'), RJ.fields.make.status, rv('model'), RJ.fields.model.status], ['PORSCHE', 'derived', 'TAYCAN 4S', 'exact']);
t.ok('real layout: derived make carries its provenance', /derived from Vehicle Model: PORSCHE\/TAYCAN 4S/.test(RJ.fields.make.source));
t.eq('real layout: subject reads Porsche · Taycan 4S', (s => [s.make, s.model, s.name])(M.subjectFrom(RJ.fields, 35000, AS_AT)), ['Porsche', 'Taycan 4S', 'Porsche Taycan 4S']);
t.eq('real layout: COE expiry with a time suffix and a descriptive COE category stay missing (not guessed)', [rv('coeExpiry'), rv('coeCat'), RJ.fields.coeExpiry.status, RJ.fields.coeCat.status], [null, null, 'missing', 'missing']);
t.eq('real layout: road tax absent → missing, not on document', [rv('roadTaxExpiry'), RJ.fields.roadTaxExpiry.source], [null, 'not on document']);
t.eq('real layout: 12 of 15 fields found (COE expiry, COE category, road tax left missing)', RJ.found, 12);
t.ok('real layout: no fake personal value anywhere in the parser output', !/JOHN|DOE|SXX1234Z|FAKE STREET|123456/.test(JSON.stringify(RJ)));
t.ok('real layout: no raw lines persisted', !('lines' in RJ) && !('raw' in RJ) && !JSON.stringify(RJ).includes('Vehicle particulars'));
// Same-line values still win, and lookahead never crosses a personal / boundary label.
t.eq('same line: label: value and label<tab>value unchanged', [M.parseLta(['Propellant: Electric']).fields.propellant.value, M.parseLta(['Open Market Value\t$1,000.00', '$2,000.00']).fields.omv.value], ['Electric', 1000]);
t.eq('one below / two below', [M.parseLta(['Actual ARF Paid', '$5.00']).fields.arf.value, M.parseLta(['Actual ARF Paid', 'note', '$5.00']).fields.arf.value], [5, 5]);
t.eq('three below is too far', M.parseLta(['Actual ARF Paid', 'a', 'b', '$5.00']).fields.arf.value, null);
t.eq('boundary: a personal label between label and value stops the lookahead', [M.parseLta(['Vehicle Model', 'Owner Name', 'PORSCHE/TAYCAN 4S']).fields.model.value, M.parseLta(['Open Market Value', 'Chassis No.', '$136,610.00']).fields.omv.value], [null, null]);
t.eq('boundary: another field\'s label in the same column stops the lookahead (no cross-field capture)', M.parseLta(['Open Market Value', 'Actual ARF Paid', '$182,898.00']).fields.omv.value, null);
t.eq('columns: a label row in a different column is skipped, value read from own column', M.parseLta(['Open Market Value\tActual ARF Paid', '\t$182,898.00', '$136,610.00\t']).fields.omv.value, 136610);
t.eq('invalid nearby candidate stays missing', [M.parseLta(['No. of Transfers', 'two']).fields.transfers.value, M.parseLta(['COE Expiry Date', '28/04/2032 23:59']).fields.coeExpiry.value], [null, null]);
t.eq('free text below a label is taken only when led by a known make', [M.parseLta(['Vehicle Model', 'JOHN DOE']).fields.model.value, M.parseLta(['Vehicle Model', 'NOTAMAKE/THING']).fields.model.value, M.parseLta(['Vehicle Model', 'MERCEDES-BENZ/E200 AVANTGARDE']).fields.model.value], [null, null, 'E200 AVANTGARDE']);
t.eq('make split only from a real make; otherwise model kept whole and make missing', (f => [f.make.value, f.model.value])(M.parseLta(['Vehicle Model\tNOTAMAKE/THING']).fields), [null, 'NOTAMAKE/THING']);
t.eq('make field present on the document wins over derivation', (f => [f.make.value, f.make.status, f.model.value])(M.parseLta(['Vehicle Make\tPORSCHE', 'Vehicle Model\tTAYCAN 4S']).fields), ['PORSCHE', 'exact', 'TAYCAN 4S']);

// ================================================================ K. Regression: model value below a right-column personal-label row (Vendi's document)
// Layout: "Vehicle Model" (left column) · next visual row holds only "Vehicle No." in the RIGHT column · then the
// model value in the left column · then the vehicle number in the right column. Fake values only.
const K_ITEMS = [];
const add = (str, x, y) => K_ITEMS.push({ str, x, y, w: str.length * 5, page: 1 });
add('Vehicle Registration Details', 56, 780);
add('Vehicle Model', 56, 740); add('Vehicle No.', 300, 733);
add('PORSCHE/TAYCAN 4S', 56, 720); add('SXX1234Z', 300, 713);
add('Propellant', 56, 700); add('Owner Name', 300, 693);
add('Electric', 56, 680); add('JOHN DOE', 300, 673);
add('Open Market Value', 56, 660); add('Registered Address', 300, 653);
add('$136,610.00', 56, 640); add('1 FAKE STREET', 300, 633);
const K_LINES = M.itemsToLines(K_ITEMS);
t.eq('regression: a lone right-column item lands in column 1, not column 0', [K_LINES[1], K_LINES[2], K_LINES[3]], ['Vehicle Model', '\tVehicle No.', 'PORSCHE/TAYCAN 4S']);
const KJ = M.parseLta(K_LINES);
t.eq('regression: model read past a personal label that sits in the other column; make derived', [KJ.fields.model.value, KJ.fields.make.value, KJ.fields.make.status, KJ.fields.propellant.value, KJ.fields.omv.value], ['TAYCAN 4S', 'PORSCHE', 'derived', 'Electric', 136610]);
t.ok('regression: nothing personal in the output', !/SXX1234Z|JOHN|DOE|FAKE STREET/.test(JSON.stringify(KJ)));
t.eq('regression (lines form): personal label in the other column, own column empty → continue', M.parseLta(['Vehicle Model', '\tVehicle No.', 'PORSCHE/TAYCAN 4S']).fields.model.value, 'TAYCAN 4S');
t.eq('boundary kept: personal label in the SAME column → stop', M.parseLta(['Vehicle Model', 'Vehicle No.', 'PORSCHE/TAYCAN 4S']).fields.model.value, null);
t.eq('boundary kept: personal label elsewhere but own column NOT empty → stop', M.parseLta(['Vehicle Model', 'SXX1234Z\tOwner Name', 'PORSCHE/TAYCAN 4S']).fields.model.value, null);
t.eq('boundary kept: personal label in the other column never yields a value from that row', M.parseLta(['Open Market Value', '\tOwner Name', '\tJOHN DOE', '$1.00']).fields.omv.value, null);
t.eq('columns: tab count between items follows column starts (label col 0, value col 1)', M.itemsToLines([{str:'Vehicle Make',x:56,y:700,w:60,page:1},{str:'PORSCHE',x:300,y:700,w:40,page:1},{str:'a',x:56,y:680,w:5,page:1},{str:'b',x:300,y:680,w:5,page:1},{str:'c',x:56,y:660,w:5,page:1},{str:'d',x:300,y:660,w:5,page:1}])[0], 'Vehicle Make\tPORSCHE');

// ================================================================ L. CSV export core (RFC 4180)
t.eq('csv: plain values pass through, missing → blank', M.toCsv(['a', 'b', 'c'], [[1, null, 'x']]), 'a,b,c\r\n1,,x\r\n');
t.eq('csv: commas, quotes and line breaks are quoted / doubled', M.toCsv(['n'], [['Thin market; 0 exact, 3 related'], ['say "hi"'], ['line1\nline2']]), 'n\r\n"Thin market; 0 exact, 3 related"\r\n"say ""hi"""\r\n"line1\nline2"\r\n');
t.eq('csv: numbers stay unformatted so spreadsheets read them as numbers', M.csvCell(136610), '136610');

process.exit(t.done() ? 1 : 0);
