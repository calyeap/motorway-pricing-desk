# Motorway Pricing Desk

Single-file HTML pricing desk for used-car acquisition (dealer decision support).

## Layout

| Path | What | Status |
|---|---|---|
| `motorway-pricing-desk.html` | **V0.7 app.** Single file, open in a browser. No build step. | Current |
| `fixtures/lta-taycan-4s-synthetic.pdf` | **Synthetic, sanitised** stand-in for an LTA Vehicle Registration Details PDF (Porsche Taycan 4S 4+1). Only the 11 appraisal values Calvin supplied; no personal fields at all. Regenerate with `npm run fixture:lta`. | Frozen acceptance fixture |
| `tests/` | `run.mjs` unit + fixture tests; `e2e.mjs` browser run (Playwright) with screenshots to `test-output/`. | |
| `baseline/v0.6/` | V0.6 prototype + screenshots | **Frozen rollback baseline** (tag `v0.6-baseline`). Never edit. |
| `design/final-lock/` | Direction A "Showroom Ledger" final design lock (HANDOFF.md + 8 boards) | Frozen design authority. Never edit. |
| `fixtures/sgcm-e200-avantgarde-ctrl-a.txt` | Real SGCarMart results page, Ctrl+A paste, byte-for-byte (CRLF kept) | Frozen parser fixture. Never edit. |

## Authority order (highest first)

1. Calvin's explicit instructions in the current session.
2. V0.6 logic (`baseline/v0.6`) for all calculations, filters, sort, default ticks, notes, disclaimers. Design lock says logic survives unchanged.
3. `design/final-lock/HANDOFF.md` for tokens, layout, copy, states, parser contract.
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
npm test           # parsers + maths against the real SGCarMart paste and the synthetic LTA PDF
npm run e2e        # browser run: V0.6 regression, Taycan flow, E200 full loop, 390 px
```
