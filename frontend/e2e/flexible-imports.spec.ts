import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

test('ordinary CSV mapping and row correction preserve the original export', async ({ page }) => {
  const source = `Ticket,Collected,Booked\nSYN-PREVIEW-${Date.now()},bad,20/10/2026\n`
  await page.goto('/imports')
  await page.getByLabel('Select a file').setInputFiles({ name: 'ordinary-export.csv', mimeType: 'text/csv', buffer: Buffer.from(source) })
  await page.getByRole('button', { name: 'Preview file' }).click()
  await expect(page.getByText('1 row needs attention before confirmation.')).toBeVisible()
  await page.getByLabel('Order reference', { exact: true }).selectOption('Ticket')
  await page.getByLabel('Amount', { exact: true }).selectOption('Collected')
  await page.getByLabel('Order date', { exact: true }).selectOption('Booked')
  await page.getByRole('button', { name: 'Apply mapping' }).click()
  await expect(page.getByText('Preview updated. Review the interpreted values before confirming.')).toBeVisible()
  await page.getByRole('button', { name: 'Review row 2' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByLabel('Amount', { exact: true }).fill('125.50')
  await page.getByLabel('Reason for this review').fill('Verified the amount against the synthetic order record.')
  await page.screenshot({ path: 'test-results/import-row-review.png', fullPage: true })
  await page.getByRole('button', { name: 'Apply row review' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm import' })).toBeEnabled()
  await expect(page.getByRole('cell', { name: 'bad', exact: true })).toBeVisible()
  await expect(page.locator('.validation-cell').getByText('GHS 125.50', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/import-mapping-desktop.png', fullPage: true })
})

test('real XLSX and legacy XLS uploads are recognized without user conversion', async ({ page }) => {
  await page.goto('/imports')
  for (const extension of ['xlsx', 'xls']) {
    const encoded = fs.readFileSync(path.resolve(`../backend/tests/fixtures/orders.${extension}.base64`), 'utf8')
    await page.getByLabel('Select a file').setInputFiles({ name: `existing-export.${extension}`, mimeType: 'application/octet-stream', buffer: Buffer.from(encoded.trim(), 'base64') })
    await page.getByRole('button', { name: 'Preview file' }).click()
    await expect(page.locator('.preview-panel').getByText(`existing-export.${extension}`, { exact: true })).toBeVisible()
    await expect(page.getByText(/^Excel.*file recognized/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm import' })).toBeEnabled()
    await expect(page.locator('.validation-cell').getByText('GHS 125.50', { exact: true })).toBeVisible()
  }
})
