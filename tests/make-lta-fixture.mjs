// Generates SYNTHETIC, sanitised stand-ins for an LTA Vehicle Registration Details PDF:
//   fixtures/lta-taycan-4s-synthetic.pdf  (values supplied by Calvin)
//   fixtures/lta-s2000-synthetic.pdf      (sanitised facts from a real renewed-COE appraisal: QP and PQP both present,
//                                           first registration date differs from original, PARF forfeited, "-" PARF benefit)
// They hold only appraisal-relevant values.
// No owner, ID, address, vehicle number, chassis/motor number or any other personal identifier —
// not even as placeholders. Deterministic output: re-running produces identical bytes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TAYCAN = [
  ['Vehicle Make', 'PORSCHE'],
  ['Vehicle Model', 'TAYCAN 4S 4+1'],
  ['Year of Manufacture', '2021'],
  ['Original Registration Date', '29 Apr 2022'],
  ['No. of Transfers', '2'],
  ['Propellant', 'Electric'],
  ['Open Market Value', '$136,610.00'],
  ['Actual ARF Paid', '$182,898.00'],
  ['COE Expiry Date', '28 Apr 2032'],
  ['Quota Premium', '$80,210.00'],
  ['Minimum PARF Benefit', '$91,449.00'],
];
const S2000 = [
  ['Vehicle Make', 'HONDA'],
  ['Vehicle Model', 'S2000 2.2 M'],
  ['Primary Colour', 'Blue'],
  ['Year of Manufacture', '2006'],
  ['Original Registration Date', '12 May 2006'],
  ['First Registration Date', '14 Feb 2008'],
  ['Propellant', 'Petrol'],
  ['Open Market Value', '$28,375.00'],
  ['Actual ARF Paid', '$31,213.00'],
  ['PARF Eligibility', 'Forfeited'],
  ['Minimum PARF Benefit', '-'],
  ['COE Category', 'E - Open Category'],
  ['COE Expiry Date', '13 Feb 2028'],
  ['Quota Premium (QP)', '$17,001.00'],
  ['PQP Paid', '$50,578.00'],
];

const esc = (s) => s.replace(/[\\()]/g, (c) => '\\' + c);
const text = (x, y, size, s) => `BT /F1 ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`;
function pdf(ROWS) {
  const ops = [
    text(56, 790, 9, 'SYNTHETIC TEST FIXTURE - not an LTA document - contains no personal data'),
    text(56, 760, 14, 'Vehicle Registration Details'),
  ];
  let y = 720;
  for (const [k, v] of ROWS) { ops.push(text(56, y, 10, k), text(280, y, 10, v)); y -= 22; }
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
  return out;
}
for (const [name, rows] of [['lta-taycan-4s-synthetic.pdf', TAYCAN], ['lta-s2000-synthetic.pdf', S2000]]) {
  const dest = fileURLToPath(new URL('../fixtures/' + name, import.meta.url));
  writeFileSync(dest, pdf(rows), 'latin1');
  console.log('wrote', dest);
}
