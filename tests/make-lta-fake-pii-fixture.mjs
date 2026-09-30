// Generates fixtures/lta-layout-fake-pii.pdf: a PRIVACY REGRESSION fixture. Dense multi-column layout with
// obviously FAKE personal data (JOHN DOE, S0000000A, FAKE STREET...) placed next to allowlisted vehicle fields,
// plus label-above-value rows. Tests assert none of the fake personal values reach parser output or the page.
// Not a real LTA document; no real person's data. Deterministic output.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// [x, text] items per row; y decreases per row.
const ROWS = [
  [[40, 'FAKE PII LAYOUT TEST FIXTURE - not an LTA document - all personal values are invented']],
  [[40, 'Vehicle No.'], [150, 'SXX1234Z'], [300, 'Vehicle Make'], [420, 'PORSCHE']],
  [[40, 'Vehicle Model'], [150, 'TAYCAN 4S 4+1'], [300, "Registered Owner's Name"], [440, 'JOHN DOE']],
  [[40, 'Owner ID'], [150, 'S0000000A'], [300, 'Primary Colour'], [420, 'WHITE']],
  [[40, 'Salutation'], [150, 'MR'], [300, 'Propellant'], [420, 'Electric']],
  [[40, 'Registered Address'], [150, '1 FAKE STREET #01-01 SINGAPORE 000000']],
  [[40, 'Date of Birth'], [150, '01 Jan 1980'], [300, 'Original Registration Date'], [440, '29 Apr 2022']],
  [[40, 'COE Expiry Date']],
  [[40, '28 Apr 2032']],
  [[40, 'Name']],
  [[40, 'JANE ROE']],
  [[40, 'Chassis No.'], [150, 'WP0ZZZFAKE0000000'], [300, 'Motor No.'], [420, 'FAKEMOTOR000']],
  [[40, 'No. of Transfers'], [150, '2'], [300, 'Road Tax Expiry Date'], [440, '28 Apr 2027']],
  [[40, 'Open Market Value'], [150, '$136,610.00'], [300, 'Actual ARF Paid'], [420, '$182,898.00']],
  [[40, 'IU No.'], [150, '1234567890'], [300, 'Contact No.'], [420, '+65 9000 0000']],
];

const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);
const ops = [];
let y = 800;
for (const row of ROWS) { for (const [x, t] of row) ops.push(`BT /F1 9 Tf ${x} ${y} Td (${esc(t)}) Tj ET`); y -= 20; }
const stream = ops.join('\n');
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
];
let out = '%PDF-1.4\n';
const offs = [];
objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = Buffer.byteLength(out, 'latin1');
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const dest = fileURLToPath(new URL('../fixtures/lta-layout-fake-pii.pdf', import.meta.url));
writeFileSync(dest, out, 'latin1');
console.log('wrote', dest);
