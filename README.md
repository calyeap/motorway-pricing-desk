# Motorway Pricing Desk

Single-file HTML pricing desk for used-car acquisition (dealer decision support).

## Layout

| Path | What | Status |
|---|---|---|
| `motorway-pricing-desk.html` | **V0.8 app.** Single file, open in a browser. No build step. | Current |
| `vendor/pdfjs-4.10.38/` | Pinned pdf.js (Apache-2.0), loaded before any CDN fallback | Vendored |
| `fixtures/sgcm-taycan-4s-ctrl-a.txt` | Real SGCarMart Ctrl+A paste, Taycan 4S search (9 listings: 5 active, 4 sold, 1 Motor-Way) | Frozen acceptance fixture |
| `fixtures/lta-layout-fake-pii.pdf` | Privacy regression fixture: dense layout with obviously fake personal data next to vehicle fields | Frozen; regenerate with `node tests/make-lta-fake-pii-fixture.mjs` |
| `fixtures/lta-taycan-4s-synthetic.pdf` | **Synthetic, sanitised** stand-in for an LTA Vehicle Registration Details PDF (Porsche Taycan 4S 4+1). Only the 11 appraisal values Calvin supplied; no personal fields at all. Regenerate with `npm run fixture:lta`. | Frozen acceptance fixture |
| `tests/` | `run.mjs` unit + fixture tests; `e2e.mjs` browser run (Playwright) with screenshots to `test-output/`. | |
| `baseline/v0.6/` | V0.6 prototype + screenshots | **Frozen rollback baseline** (tag `v0.6-baseline`). Never edit. |
| `design/final-lock/` | Direction A "Showroom Ledger" final design lock (HANDOFF.md + 8 boards) | Frozen design authority. Never edit. |
| `fixtures/sgcm-e200-avantgarde-ctrl-a.txt` | Real SGCarMart results page, Ctrl+A paste, byte-for-byte (CRLF kept) | Frozen parser fixture. Never edit. |

## Authority order (highest first)

1. Calvin's explicit instructions in the current session.
2. V0.6 logic (`baseline/v0.6`) for all calculations, filters, sort, default ticks, notes, disclaimers. Design lock says logic survives unchanged.
3. `design/final-lock/HANDOFF.md` for tokens, layout, copy, states, parser contract. Exception: the corner-radius system (4 / 6 / 8 px) and typography weights/tracking approved by Calvin on 30 Sep 2026 (commits `d64e4f7`, `783b7a2`) supersede HANDOFF.md §2; the HANDOFF file itself stays frozen. Visual design frozen at `783b7a2`.
4. `design/final-lock/html/A1–A8` boards for visual detail HANDOFF.md does not specify.
5. The fixture for what SGCarMart actually emits. Where the boards' sample data disagrees with the fixture, the fixture wins on parsing; the boards win on presentation.

Sample data in the boards is fictional. Only the fixture is real.

## V0.7 demo loop

```
LTA PDF + mileage → this car → SGCarMart Ctrl+A paste → shortlist → Comparison → dealer economics → AI second opinion (advisory) → owner final decision
```

- **LTA PDF** is read in the browser (pdf.js from a CDN); the file is never uploaded. Only whitelisted vehicle labels are read. Owner, ID, address, vehicle number, chassis/motor number and other labels are used as boundaries and their values are never read, shown or kept. Exact PDF values are used as read; Edit is a fallback and is marked as dealer-edited.
- **Sold** = SGCarMart's explicit listing status only (`sold` + `View Similar` in the listing header). Description text is never used. Sold listings are parsed, set aside, never shortlisted, and never count in the asking figures (they have no asking price).
- **Maths** is V0.6's, unchanged: tests prove the V0.6 sample gives the same median, maximum and gross profit in both versions.
- **AI second opinion** is not connected in V0.7. The Advisory block is always shown, with a "Copy brief" button (vehicle facts + selected comps + inputs; no PII exists in state to copy).

## Privacy rule

Never commit a real customer document. Real LTA PDFs contain PII. Use synthetic fixtures only (`.gitignore` blocks `*.real.pdf` and `fixtures/private/`).

## Tests

```
npm install        # pdfjs-dist, for reading the PDF fixture in Node
npm test           # V0.7 regression + V0.8 core tests (both SGCarMart fixtures, LTA PDFs, snapshots/diff)
npm run e2e        # browser run: V0.6 regression, Taycan flow, E200 full loop, 390 px
```

## V0.8 (bounded hardening pass)

- **Own stock:** Motor-Way / Motorway dealer names → "Motorway stock", unticked, never independent evidence. "Possible same car" when registration date, exact variant, COE left and owner count match this car.
- **Thin market:** evidence is split into exact-variant independent active / related variant / Motorway stock / sold. Fewer than 3 exact independent comps → **THIN MARKET / REVIEW** with reasons.
- **Variants:** exact / related (shown as "Related variant — … · not the same spec"; included but never counted as exact) / different body style. Seat layouts like `4+1` ignored. No scores, no price-ratio or OMV rule (internal class name stays `adjacent`).
- **Source vs derived:** transfers are source truth; owners = transfers + 1 is a dealer-confirmed rule (Vendi), still labelled "(derived)"; original/renewed COE is labelled "(inferred)".
- **OMV:** shown as context only ("OMV context only · not used in pricing maths"). Never decides comp quality or adjusts any figure. Real SGCarMart pastes carry no per-listing OMV.
- **Market pace (dealer-validated evidence, no score):** SGCarMart "Posted" date shown per listing as "Posted 28 Sep · 2 days ago" (days to the capture date, not true time on market). Market Pulse counts are "Active listings in this capture"; price cuts are seller pressure, not proof of low demand; gone ≠ sold unless SGCarMart marks it sold.
- **Holding risk → buffer:** the fourth input is "Target profit buffer" (a dollar amount, dealer's call). Softer asking evidence → "consider a larger profit buffer"; mixed → "review holding risk". Text only: the maximum never changes automatically. Formula unchanged: resale − recon − other − buffer.
- **Blank costs:** V0.6 maths unchanged, but the maximum is marked provisional with an amber warning on the rail and the Decision Summary.
- **Privacy:** first cell only, typed and allowlisted values, free text never read from the next line; pdf.js served from `vendor/`.
- **Flow:** sticky Back / Continue on every stage; final offer (owner) is separate from the starting offer (dealer); exceptions-only filter; "Why this comp?"; owner summary replaces the external-AI brief.
- **Market Pulse (manual, daily):** the dealer searches the same SGCarMart market each day. "Market history → Save today's market" downloads a snapshot JSON (market data only, no subject car); the next day "Compare with previous" diffs by a price-free identity (title + registration + dealer, mileage as check). Absent = *no longer listed*; only SGCarMart's own status = *sold*. Partial or different coverage → loud warning, absences not classified.
- **No auto-scraping, no backend, no storage:** the app makes no network requests for data; a test enforces it.

## NEXT — deferred until Vendi validates the core appraisal workflow

**AI second opinion (not implemented; approved design, 30 Sep 2026).** One Claude call, structured JSON reply, rendered only inside the dashed Advisory block (`design/final-lock` A6 §06), behind an explicit button.

- Outputs, kept very compact — number + evidence TL;DR, not coaching: suggested sale-price range (whenever comps exist); suggested opening-offer range (only once deal numbers exist); at most 1–2 short evidence reasons; one line "advisory only · dealer decides". No numbered advice lists, no generic car-buying tips, no explaining the dealer's job back to him, no essays.
- Hard rules, enforced by the desk not the model: advisory only; never called a valuation or a "safe price"; never changes Expected sale price, Target gross profit or any dealer input; never changes Maximum purchase price; opening-offer range must sit below Maximum purchase price or the block shows "No second opinion available"; never chooses Final offer.
- Sent: comp rows (asking, dep/yr, km, owners, COE left, exact/related, posted-days), subject figures as deltas, deal numbers incl. the maximum as ceiling, Market Pulse read. Not sent: car identity, LTA fields, listing URLs, dealer names, seller free text, starting/final offer.
- Needs a small key-holding proxy (the single-file app must never embed an API key) and an opt-in line stating what is sent. This would be the desk's only network request; test G changes to allow the proxy host only.
- Model default `claude-opus-5-5`, adaptive thinking, structured output. ~1¢ and 3–8 s per opinion. Effort ≈ 1.5 days incl. proxy and a 10-case eval on the two fixtures.
