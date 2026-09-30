# Motorway Pricing Desk — Direction A "Showroom Ledger" · Final design lock

Design-only handoff for Claude Code. Visual source of truth = the eight FINAL boards on the canvas (`html/A1…A8`).
No product logic changes. The V0.6 prototype's calculations, filters, sort, tick/untick, notes and disclaimers all survive unchanged; only their presentation changes, plus the Import flow in front of them.

Mental model the UI must make obvious:

```
FACTS  →  CHECK & MATCH  →  DEALER MATH  →  AI SECOND OPINION  →  OWNER DECIDES
(subject)  (import, shortlist,  (max acquisition   (advisory range +     (final offer +
            comparison deltas)   price, inputs)      reasons)              projected GP)
```

---

## 1. Screens and states (board map)

| # | Board | State it shows |
|---|---|---|
| A1 | Import — empty | Primary action "Paste SGCarMart results", 3-step instruction, "Load demo results", what gets kept / ignored |
| A2 | Import — processing | Progress bar + checklist: identifying listings ✓ · ignoring nav/ads ✓ · structuring fields (62/94) · differences · shortlist |
| A3 | Parsed summary + Suggested shortlist | Summary strip (94 detected · 88 ready · 6 need dealer input · 41 blocks ignored) · shortlist tier with state icons · Continue |
| A4 | All parsed / candidate review | Tiered pool: In shortlist → Needs dealer input (conflicting values, variant unclear) → Plausible (incl. exact-but-unusual and Not stated rows, no click needed) → Set aside → Ignored page text |
| A5 | Comparison desk | Fixed rail hierarchy; secondary fields hidden behind "Show OMV · ARF · registered"; starting offer + projected GP |
| A6 | Decision Summary | 8 sections; Max (charcoal) ≠ AI (dashed, Advisory) ≠ Final offer (red rule) + Projected GP |
| A7 | Responsive | 390 px: import / comparison cards / decision single column |
| A8 | Tokens | Colour, semantic rules, row states, type scale, spacing, motion |

Navigation: one app bar, three steps `① Import · ② Comparison · ③ Decision Summary`. Completed steps get a sage tick in the circle; the active step has the red underline. Same bar on every screen; no sidebar.

---

## 2. Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `ground` | `#F4F4F2` | page background |
| `surface` | `#FFFFFF` | panels, tables, inputs |
| `surface-sunk` | `#F7F7F5` | "This car" baseline row, tier header rows |
| `charcoal` | `#262626` | subject stage band, Maximum acquisition price block, mobile payoff footer. Nothing else |
| `ink` | `#1B1B1B` | primary text, focus ring, active input border, secondary buttons |
| `ink-2` | `#4A4A48` | body on light |
| `muted` | `#6B6B6B` | labels, eyebrows, secondary text (5.3:1) |
| `delta-grey` | `#8A8A87` | normal deltas, excluded-row text (12 px non-essential; 3.4:1) |
| `on-dark-muted` | `#A9A9A6` | captions on charcoal (5.9:1) |
| `hairline` | `#D8D8D6` | panel borders, table head rule (site card border) |
| `rule-soft` | `#EDEDEA` | in-panel dividers, row dividers |
| `red` | `#BC151B` | brand mark, active step underline, primary button, subject rule, decision-block rule |
| `red-hover` | `#A51618` | primary button hover (site CTA red) |
| `amber` | `#9A6412` | review text (4.9:1). Dot `#C98A1F`. Row tint `#FDFAF2` for needs-dealer-input rows. "Example inputs" tag |
| `sage` | `#3F6B4C` | included tick, completed step, parsed-OK count, Confirm action (5.6:1). Tint `#EEF4EF` (unused by default) |

### Semantic rules (hard)

- **Red** = brand / active / the one primary action on a screen / major decision emphasis. Never on data, never on a delta, never "bad".
- **Amber** = look here. Review deltas (±10 % depreciation vs selected median; mileage delta ≥ 20,000 km; owners delta ≠ 0; COE renewed/short), `Unusual — review` notes, needs-dealer-input rows, unticked-by-default reasons, the Advisory label.
- **Sage** = confirmed / included / parsed OK / step done. Never "good deal".
- **Grey** = normal, secondary, excluded, set aside, Not stated.
- **Charcoal fill** = deterministic. Subject stage and the payoff only.
- No green/red price judgement. No gradients, glows, shadows, or badges. No chip clusters.

### Typography

Fonts: **Montserrat** (Motorway's site face) 600/700 · **IBM Plex Sans** 400/500/600. Every number gets `font-variant-numeric: tabular-nums`.

| Role | Face | Size / weight | Where |
|---|---|---|---|
| payoff | Montserrat | 44 (Decision) / 40 (rail) · 700 · ls −0.02em · lh 1.05 | Max acquisition price, Projected GP on Decision |
| model name | Montserrat | 34 (Decision) / 28 (desk) / 22 (import) · 700 · ls −0.01em · lh 1.15 | subject band |
| key figure | Montserrat | 30 (TL;DR) / 22 (rail median) · 700 | TL;DR, median asking, subject figures (Plex 600 22) |
| section | Montserrat | 17 (Decision) / 15 (desk) · 700 | panel titles |
| eyebrow | Montserrat | 11 · 600 · caps · ls 0.09em · muted | all small labels |
| price | Plex | 16 · 600 | asking price cell — the only bold number in a row |
| value | Plex | 15 · 500 · lh 1.25 | table values; unit suffix 12 · 400 · `#7A7A77` |
| body | Plex | 14 · 400 · lh 1.4 | notes, Decision observations 15 |
| secondary | Plex | 13 · muted | counts, helper |
| delta / caption | Plex | 12 · delta-grey or amber · 3 px below value | every delta |

### Spacing and surfaces

- Base 4 · scale 4 / 8 / 12 / 16 / 24 / 32.
- Page margin 32 · gutter 24 · money rail 352 px · Decision reading column 920 px (72 px number gutter + 24 gap).
- Panels: padding 16–18, one 1 px hairline, **radius 0**. Inputs, buttons, pills: radius 2. Nothing pill-shaped.
- Table: cell padding 10 × 12; head 10 / 8; rows ≈ 52 px, ≈ 72 with a note line. Table min-width none — columns are: state 40 · listing (flex) · asking · depreciation · mileage · owners · COE.
- Subject band: 22 px padding on desk; 14 px on import screens. 3 px red rule left of the name.
- Rail sections: hairline between; charcoal block full-bleed inside the panel.

---

## 3. Component rules

### Subject car (stage band)
Charcoal band, red rule, model name, one grey line (`W213 · Condition Good · Paper value (PARF) not provided`). Three figures at 22 px: mileage, owners, COE left. Registered / OMV / ARF at 12 px on-dark-muted, right of a 1 px `#444` divider. Never a card; never repeated inside the table (the baseline row carries the numbers).

### Comparable row (ledger grammar)
```
[state] Listing name (600)          $107,500 (600)   $22,400 /yr    96,000 km    3      3y 7m
        Listing 4 · Fair                             −$3,235 vs med +24,000      +1     +2 mo
        Review · lower depreciation than selected comps        ← one plain note line, amber or grey
```
- Value on top, delta beneath. Delta text: `+24,000`, `−$3,235 vs median`, `same`, `+2 mo`, `Renewed · +75 mo`.
- Amber delta only when it crosses the review threshold; otherwise delta-grey.
- Flags collapse into **one** note line under the name: `Review · …`, `Unticked by default · short COE · registered 9+ yrs ago`, `Not stated · ARF, condition`. Multiple notes stack as separate 12 px lines, never badges.
- Excluded / unticked rows: text → delta-grey, checkbox unticked; note stays amber. No opacity on inputs.
- "This car" baseline row: sunk fill, 3 px red inset rule on the first cell, `—` for asking/depreciation.
- Secondary fields (registered, OMV, ARF, condition, paper value, notes) are hidden on the Comparison desk behind `Show OMV · ARF · registered` (adds one 12 px grey trailing column). On import pool boards they show as that trailing column because the table has full width.

### State column (first column, 40 px)
| Icon | Meaning |
|---|---|
| sage filled box + white tick | included / counted |
| empty box | available (parsed, not in shortlist) |
| box with amber dot | needs dealer input — conflicting values or ambiguous variant; resolve before it can be included |
| sunk box with grey dash | unticked by default / set aside |
On the Comparison desk the column is a native checkbox (`accent-color: sage`). On import boards it is the icon; clicking it toggles inclusion.

### Money rail (Comparison desk), top to bottom — one panel, hairlines between
1. **Asking evidence · n selected** — Median asking (22 Montserrat), Lowest · highest, Median depreciation / yr.
2. **Dealer economics** — four inputs in a 3-column grid (`label | − | input 112 px`); `Example inputs` amber dashed tag while values equal defaults; one helper line "Resale is $2,150 below the median asking."
3. **Maximum acquisition price** — charcoal block, 40 px, working line `112,000 − 3,500 − 1,500 − 8,000`.
4. **Starting offer** — same field grid, ink border; helper "$4,000 below the maximum. Dealer enters this; the desk never suggests it." Blank state: "Enter to see projected gross profit."
5. **Projected gross profit at this offer** — 26 px Montserrat + working line.
6. One footer disclaimer line: "Asking prices are not sale prices. The desk does not calculate a market value or a correct price."
Micro-copy removed vs V0.6: duplicated "decision support only", "dealer decides" sentence in the rail, "not entered / not suggested" pairs, per-section explainer paragraphs.

### Decision Summary (920 px column, numbered gutter)
01 Car · 02 Comparable-market TL;DR (three figures with 2 px left rules) · 03 Key differences (dot list; amber dots for review items) · 04 Dealer economics (ledger, no inputs) · 05 Maximum acquisition price (charcoal block, "Dealer math. Moves only when the inputs move.") · 06 AI second opinion (dashed `#B9B9B6` border, `#FAFAF8` fill, amber-outlined `ADVISORY · NOT A VALUATION · NOT THE MAXIMUM` tag, range at 24 px **regular weight**, 3 numbered reasons, one line "It never changes the maximum, the inputs or the offer.") · 07·08 Decide: white block with a **3 px red top rule** — Final offer input (56 px, ink border, 28 px value) left; Projected gross profit (44 px Montserrat) + "Owner makes the final decision." right.
Three treatments, never blended: charcoal fill = math · dashed outline = advisory · red rule + ink input = owner.

### Import flow
- Empty: heading, 3 numbered steps in a row, dashed paste target (`#B9B9B6`, `#FAFAF8` fill) holding the single red button; `Ctrl+V anywhere` note; `Load demo results` link. No textarea visible — the whole page accepts paste.
- Processing: 3 px progress bar (ink on rule-soft), count `62 of 94 listings`, five checklist rows (sage tick / ring spinner / empty box).
- Summary strip (white, hairline below): `94 vehicle listings detected` · sage `88 ready to review` · amber `6 need dealer input` · grey `41 page blocks ignored (…)` · `Paste again` · "Exact source values are accepted as read. Missing fields show *Not stated*. Nothing is guessed."
- Pool tabs: Suggested shortlist 8 · Plausible 24 · All parsed 94 · Needs input 6 · Ignored 41. Search field + Variant / COE / Reg year / Mileage pills.
- Tiers inside All parsed: `IN SHORTLIST · 8` → `NEEDS DEALER INPUT · 6` → `PLAUSIBLE · 16 more` → `SET ASIDE · 64` → `Ignored page text · 41 blocks` (one grey row with `Show ignored blocks`). Tier rows use surface-sunk + eyebrow type.
- **Field-value rules (minimum clicks, never a silent guess):**

  | Parser result | Stored value | UI | Dealer action |
  |---|---|---|---|
  | Exact, unambiguous value in the source | the value as read | normal row | none |
  | Exact but unusual (e.g. `Mileage 12,000 km` on a 2020 car) | the value as read | amber note `Unusual — review · … · accepted as read`; amber delta; 11 px grey `source: "Mileage 12,000 km"` under the value (also on hover/focus) | none required; can Edit |
  | Two values conflict (e.g. `Mileage 9,600km` in the spec line vs `96k km` in the description) | nothing until chosen | amber-dot state, `#FDFAF2` tint, note `Needs input · two mileage values in the source — pick one`; the cell shows each candidate as a small outlined button with its source text, plus `Edit` | pick one or edit |
  | Parser can't tell which listing a value belongs to | nothing until chosen | same as conflict | pick or edit |
  | Variant ambiguous (title vs description) | nothing until chosen | name shows `(variant unclear)` in amber, note quotes both strings, two outlined choice buttons | pick one |
  | Field missing | `null` | italic `Not stated` in the cell, grey note `Not stated · owners, depreciation — nothing filled in` | none |

  Only the amber-dot rows (conflict / unattributable / variant) block inclusion; everything else is tickable immediately. Unusual thresholds reuse the existing review thresholds (mileage delta ≥ 20,000 km, ±10 % depreciation, owners ≠ subject) plus one plausibility check: mileage under 5,000 km or over 30,000 km per year of age → unusual. Thresholds are constants, not AI judgement.
- Footer: count sentence left, `n comparables will open in Comparison` + red `Continue to Comparison →` right. Same on every pool tab.
- Selected comps flow into the existing Comparison desk; the desk footer gains `Add from import`.

### Responsive (390 px)
- App bar keeps the three-step nav as text tabs. Subject band compact (model name 19, three figures in a row, `Details ▾`).
- Import: one primary button; summary and shortlist as stacked cards; Continue pinned last.
- Comparison: one card per comparable — name, listing meta, asking 16/600 + state icon; 4-column grid of the primary fields (`DEP/YR · MILEAGE · OWNERS · COE`) as value/delta pairs with abbreviated numbers (`$22.4k`, `96k`). Charcoal footer pinned: Max acquisition + median asking, `Economics ▴` opens the rail as a bottom sheet. Filters, sort, OMV/ARF stay desktop.
- Decision: same eight sections single-column; Key differences truncated to 2 + `n more`; AI reasons collapsed `3 reasons ▾`; red-ruled decision block last.

---

## 4. Motion and interaction

- Hover / focus: colour only, 120 ms ease-out. Focus ring 2 px ink, offset 1.
- Paste: progress bar width transitions 200 ms; checklist rows tick in sequence 160 ms each; one ring spinner max. When done, the summary strip and table fade in 0 → 1 over 200 ms, once, no slide.
- Tick / untick, input edits: recalculate instantly, no animation, no flashing figures; `aria-live="polite"` on the rail and on the Max block.
- Conflict choice: clicking a candidate value commits it, clears the amber dot and tint, and makes the row tickable. `Edit` swaps the cell to an input (Enter commits, Escape cancels). Unusual values need no click; `Edit` is available on hover/focus.
- Sort: header click toggles ▲/▼; rows re-order without animation.
- Tabs and tiers: instant.
- `prefers-reduced-motion: reduce` disables all transitions and the spinner (static ring).

---

## 5. Implementation notes for Claude Code

**Keep**
- All V0.6 logic: `visible()` filters, sort with null-last, `defaultInc()` (renewed or < 24 mo COE start unticked), `median()`, `notes()` thresholds (±10 % depreciation; ≥ 9 yrs reg), `renderMoney()` including blank-field handling and cautions, `DEFAULTS`, `Reset desk`, `Clear inputs`, "What the notes mean".
- Starting offer stays dealer-entered; projected gross profit is the existing `offerNote` maths surfaced as its own rail section.
- Decision Summary is a second view over the same state object — no second calculation path. Final offer and Starting offer are the same field (`offer`); the Decision view labels it Final offer.

**Add**
- Import state: `rawPaste`, `parsed[]` (each listing carries per-field `{value, source, status}` and a listing status `ok | needs_input | aside | noise`), `shortlist[]`, and `included` is derived from the existing `state.inc`.
- Parser contract: every field carries `{value, source, status}` with `status ∈ exact | unusual | conflict | unattributed | missing`. `exact` and `unusual` are stored automatically (`unusual` only adds an amber note). `conflict` / `unattributed` store `value: null` plus `candidates[]` (each with its source text) and set the listing to `needs_input` until the dealer picks. `missing` → `null` → renders `Not stated`. The parser never picks between candidates and never fills a gap.
- Shortlist heuristic is deterministic and visible (`Why these?`): same model family, original COE, registration within ±18 months, then closest on mileage/owners/COE; the two "different COE situation" rows are included for reference and start unticked (existing `coeDiffers` rule).
- AI second opinion (Decision view only): input = selected comparables + dealer inputs; output = range + ≤ 3 reasons; render only inside the dashed Advisory block; it can never write to inputs, `offer`, or the max. Show a loading placeholder in the same block; on failure show "No second opinion available" — never hide the block.
- Global paste handler on the Import screen (`document.addEventListener('paste')`), plus the button (opens a hidden textarea for browsers that block programmatic clipboard read).

**Do not**
- No green/red for value judgement, no badges, no cards inside cards, no shadows, no gradients, no icons beyond the state glyphs and chevrons, no emoji, no animated numbers.
- No new fields, no market value, no automatic offer.

**Fonts**: Google Fonts `Montserrat:wght@500;600;700` + `IBM+Plex+Sans:wght@400;500;600`. If offline: `system-ui` fallback keeps tabular numerals via `font-variant-numeric`.

**Accessibility**: 4.5:1 on all body text (delta-grey is used only at 12 px for non-essential deltas; bump to `muted #6B6B6B` if an audit requires). Real `<button>`, `<input>`, `<label for>`, `aria-label` on state toggles and icon-only controls, `aria-sort` on sortable headers, `aria-current="page"` on the active step.

Sample data note: logo mark is a placeholder glyph — replace with the official Motorway asset. All listings and AI text are fictional demo content.
