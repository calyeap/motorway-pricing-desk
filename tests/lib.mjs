// Shared test helpers: load the shipped core out of the app HTML, tiny assert, pdf.js text extraction.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export function loadCore() {
  const html = readFileSync(root + 'motorway-pricing-desk.html', 'utf8');
  const core = html.match(/<script id="mpd-core">([\s\S]*?)<\/script>/)[1];
  const ctx = { module: { exports: {} } };
  vm.createContext(ctx);
  vm.runInContext(core, ctx);
  return ctx.module.exports;
}
export function suite() {
  const s = { pass: 0, fail: 0 };
  s.eq = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    ok ? s.pass++ : s.fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
  };
  s.ok = (name, cond, detail = '') => s.eq(name + (detail ? ` (${detail})` : ''), !!cond, true);
  s.done = () => { console.log(`\n${s.pass} passed, ${s.fail} failed`); return s.fail; };
  return s;
}
export const fixture = (name) => readFileSync(root + 'fixtures/' + name, 'utf8');
export async function pdfLines(M, file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(root + 'fixtures/' + file)), isEvalSupported: false, verbosity: 0 }).promise;
  const items = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    (await pg.getTextContent()).items.forEach(it => items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: n }));
  }
  return M.itemsToLines(items);
}
export const AS_AT = new Date(2026, 8, 30);
