// Regression for the measurement itself: offscreen children in a valid scroll
// container are intentional; an oversized container and negative overflow are not.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { auditLayout } from './layout-audit.mjs';
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.setContent('<body style="margin:0"><div style="width:300px;overflow-x:auto"><div style="width:900px">Scrollable table</div></div><button style="width:44px;height:44px">OK</button></body>');
  let audit = await page.evaluate(auditLayout);
  assert.equal(audit.outside.length, 0, 'intentional horizontal scrolling must be allowed');
  assert.equal(audit.smallTargets.length, 0);
  await page.setContent('<body style="margin:0"><div style="width:400px">Overflow</div><div style="position:absolute;left:-20px;width:50px">Left</div><button style="width:34px;height:34px">Bad</button></body>');
  audit = await page.evaluate(auditLayout);
  assert(audit.outside.some((el) => el.right === 400));
  assert(audit.outside.some((el) => el.left === -20));
  assert.equal(audit.smallTargets.length, 1);
  console.log('Mobile layout audit: clipping, right/left overflow and 44px target regressions passed');
} finally { await browser.close(); }
