import { expect, test } from '@playwright/test'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'

test.use({ javaScriptEnabled: false })
test('the source guide works offline without scripts and names real source anchors', async ({ page }) => {
  const route = pathToFileURL(path.resolve('../devpost/app-map.html')).href
  await page.goto(route)
  await expect(page.getByRole('heading', { name: 'ReconcileOS source guide' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reference route: confirm, reconcile, inspect' })).toBeVisible()
  const source = await readFile(path.resolve('../backend/app/services/reconciliation/engine.py'), 'utf8')
  expect(source).toContain('def reconcile(')
  expect(await readFile(path.resolve('../backend/tests/test_flexible_imports.py'), 'utf8')).toContain('def test_')
  expect(await page.locator('script').count()).toBe(0)
  await page.screenshot({ path: 'test-results/app-map.png', fullPage: true })
})
