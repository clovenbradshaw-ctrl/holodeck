// smoke-summary.mjs — drive the live surface: ingest text, open a profile,
// and assert the summary field renders at every size with provenance.
import { openSurface } from './drive-holodeck.mjs';

const TEXT = `A resolution on affordable housing advanced Thursday at the Metro Council. Freddie O'Connell, the mayor of Nashville, said the transit plan needs more funding. The Metropolitan Development and Housing Agency manages the affordable housing program in Nashville. Council member Sandra Phillips argued the housing budget was too small and asked for more money next year.`;

const surf = await openSurface({ headless: true });
let fail = 0;
const check = (cond, msg) => { if (cond) console.log('  ok  ' + msg); else { console.log('  FAIL ' + msg); fail++; } };
try {
  await surf.settle(4000);
  const page = surf.page;

  // Add & publish → Paste text → paste → Add text
  const addBtn = page.locator('button', { hasText: /Add & publish|Upload or paste a file/ }).first();
  if (!(await addBtn.count())) { console.log('no add entry'); process.exit(1); }
  await addBtn.click();
  await surf.settle(1500);
  const pastePill = page.locator('button', { hasText: 'Paste text' }).first();
  await pastePill.click();
  await surf.settle(1000);
  const ta = page.locator('textarea[placeholder*="Paste text here"]').first();
  await ta.fill(TEXT);
  const addText = page.locator('button', { hasText: 'Add text' }).first();
  await addText.click();
  await surf.settle(10000);

  const namesBtn = page.locator('button', { hasText: /Names/ }).first();
  if (!(await namesBtn.count())) { console.log('no Names nav after ingest'); process.exit(1); }
  await namesBtn.click();
  await surf.settle(2500);

  const row = page.locator('table tbody tr').first();
  if (!(await row.count())) { console.log('no name rows'); process.exit(1); }
  const name = await row.innerText();
  console.log('first name row: ' + name.replace(/\s+/g, ' ').slice(0, 60));
  await row.click();
  await surf.settle(2500);

  const body = await surf.bodyText();
  check(/what it is about/i.test(body), 'profile view shows the summary section');
  check(/one line/.test(body) && /all, cited/.test(body), 'size controls present');

  const sumText = await page.locator('section', { hasText: 'What it is about' }).first().innerText().catch(() => '');
  console.log('-- summary section --\n' + sumText.slice(0, 400));
  check(/key:/.test(sumText) || /is read as/.test(sumText), 'one-line summary renders');

  // grow to full
  const fullBtn = page.locator('button', { hasText: 'all, cited' }).first();
  await fullBtn.click();
  await surf.settle(1500);
  const fullText = await page.locator('section', { hasText: 'What it is about' }).first().innerText().catch(() => '');
  console.log('-- full section --\n' + fullText.slice(0, 600));
  check(/stmt/.test(fullText), 'full mode cites source statement counts');
  check(/cited in/.test(fullText), 'full mode lists the citing sources');

  // shrink to one line
  const smallBtn = page.locator('button', { hasText: 'one line' }).first();
  await smallBtn.click();
  await surf.settle(1500);
  const smallText = await page.locator('section', { hasText: 'What it is about' }).first().innerText().catch(() => '');
  check(!/stmt/.test(smallText), 'one-line mode is short, no per-statement counts');

  // switch the summary to Japanese (SOV) — the scaffolding and verb must change
  const langSel = page.locator('section', { hasText: 'What it is about' }).locator('select').first();
  await langSel.selectOption('ja');
  await surf.settle(2000);
  const jaBody = await surf.bodyText();
  check(/日本語/.test(jaBody), 'language picker lists the lens');
  check(/これは何か/.test(jaBody), 'Japanese renders its own "about" label');
  check(/読まれ/.test(jaBody), 'Japanese renders SOV scaffolding');

  const warns = surf.consoleErrors.filter(w => /never resolved|not an array|rendered as empty/.test(w)).slice(0, 10);
  check(warns.length === 0, 'no template resolution warnings (' + (warns.length ? warns.join(' | ') : 'clean') + ')');

  await surf.shot('smoke-summary');
} finally {
  await surf.close();
}
console.log(fail ? 'SMOKE FAILURES: ' + fail : 'SMOKE PASS');
process.exit(fail ? 1 : 0);