import assert from 'node:assert/strict';
import { auditLayout } from './layout-audit.mjs';
export async function checkMobileInteraction(page, name, directory) {
  if (name === 'ob-age-locked') {
    assert(await page.getByRole('button', { name: 'День', exact: true }).isDisabled(), 'saved birthday is read-only');
  }
  if (name !== 'ob-age') return;
  for (const [label, value] of [['День', '15'], ['Месяц', '06'], ['Год', '1995']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.waitForTimeout(350);
    if (label === 'Год') {
      await page.getByRole('button', { name: value, exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${directory}/birthday-year-picker.png` });
      const audit = await page.evaluate(auditLayout);
      assert.equal(audit.outside.length, 0, 'birthday picker remains in viewport');
    }
    await page.getByRole('button', { name: value, exact: true }).click();
    await page.waitForTimeout(350);
  }
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Подтвердите дату рождения', exact: true });
  await heading.waitFor();
  await page.waitForTimeout(350);
  await heading.click();
  assert(await heading.isVisible(), 'touching sheet content must not dismiss via backdrop');
  await page.screenshot({ path: `${directory}/birthday-confirmation.png` });
  const audit = await page.evaluate(auditLayout);
  assert.equal(audit.outside.length, 0, 'birthday confirmation remains in viewport');
  await page.getByRole('button', { name: 'Вернуться и исправить', exact: true }).click();
  await heading.waitFor({ state: 'hidden' });
}
