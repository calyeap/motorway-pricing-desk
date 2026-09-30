# Motorway Pricing Desk

Single-file HTML pricing desk for used-car acquisition (dealer decision support).

## Layout

| Path | What | Status |
|---|---|---|
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
