# IRS Simulator · Portugal 2026 → 2027

Mobile-friendly simulator for Portuguese IRS on employment income (Category A):

- Monthly payslip for 2026 (official 2026 withholding tables for the Mainland, Azores and Madeira), including the 50% withholding cut in November 2026
- Annual IRS, step by step: 2026 original rates, 2026 with the retroactive cut (−0.3 to −0.5 p.p. on brackets 1–6), and 2027 (brackets +3.88%, OE2027 proposal)
- Single / married (joint vs separate), dependents, ascendants, IRS Jovem, deductible expenses

Everything runs in the browser and no data is sent anywhere. These are estimates, not tax advice.

- `irs.js` — tax engine (pure functions, also loads in Node)
- `index.html` — UI
- `node build.js` — writes a single self-contained `dist/index.html`
