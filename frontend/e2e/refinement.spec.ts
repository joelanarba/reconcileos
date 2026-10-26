import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('public demo supports evidence, keyboard tabs, safe exports, and isolation', async ({ page }) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const base = 'http://127.0.0.1:8011/api'
  const expected = JSON.parse(await readFile(path.resolve('../sample-data/demo/expected-results.json'), 'utf8'))
  const dashboard = await (await page.request.get(`${base}/demo/dashboard`)).json()
  const run = dashboard.latest_run
  expect(run.original_summary).toEqual(expected.summary)
  const operatorBefore = await (await page.request.get(`${base}/dashboard`)).json()
  for (const endpoint of ['/runs', '/imports/preview?source_type=orders', '/investigations/unknown/review', '/investigations/unknown/ai']) {
    expect((await page.request.post(`${base}/demo${endpoint}`, { data: {} })).status()).toBe(403)
  }
  expect((await (await page.request.get(`${base}/dashboard`)).json())).toEqual(operatorBefore)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Find the payment differences your records missed.' })).toBeVisible()
  await expect(page.getByText('GHS 11,271.15', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Try the demo' }).click()
  await page.getByText('Take a two-minute tour', { exact: true }).click()
  await page.getByRole('link', { name: 'View reconciliation results' }).click()
  const casesTab = page.getByRole('tab', { name: 'Review cases 54' })
  await expect(casesTab).toBeVisible()
  await casesTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Accepted relationships 159' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Summary', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('GHS 5,153.00', { exact: true })).toBeVisible()
  await page.keyboard.press('Home')
  await expect(casesTab).toBeFocused()
  await page.getByLabel('Discrepancy type').selectOption('partial_payment')
  await expect(page.getByText('5 results', { exact: true })).toBeVisible()
  await page.locator('.results-table .table-link').first().click()
  await expect(page.getByRole('heading', { name: 'Payment below order value', exact: true })).toBeFocused()
  await expect(page.locator('.evidence-record')).toHaveCount(2)
  await expect(page.locator('.case-finding')).toContainText('The recorded difference is GHS')
  await expect(page.getByRole('button', { name: 'Resolve case' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Request AI assistance' })).toHaveCount(0)
  await expect(page.getByText('No saved AI investigation is available for this case.', { exact: false })).toBeVisible()
  await page.locator('.evidence-record').first().getByText('Source and import history').click()
  await page.locator('.evidence-record').first().getByRole('link', { name: 'Open import provenance' }).click()
  await expect(page.getByRole('heading', { name: 'Imported evidence', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Source row', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Reports', exact: true }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export cases CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('synthetic-demo-')
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv).toContain('partial_payment')
  expect(csv).toContain('missing_settlement_evidence')
  await expect(page.getByText('Understanding these figures')).toBeVisible()
  expect(await page.locator('.secondary-details').getAttribute('open')).toBeNull()
  await page.getByText('Understanding these figures').click()
  await expect(page.locator('.metric-definitions')).toBeVisible()
  expect(errors).toEqual([])
})

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`readable layouts and navigation at ${width}px`, async ({ page }) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 1000 })
    const base = 'http://127.0.0.1:8011/api/demo'
    const dashboard = await (await page.request.get(`${base}/dashboard`)).json()
    const cases = await (await page.request.get(`${base}/discrepancies?run_id=${dashboard.latest_run.id}&type=partial_payment`)).json()
    const paths = ['/', '/demo/dashboard', '/demo/reconciliation', '/demo/investigations', `/demo/investigations?case=${cases.items[0].id}`, '/demo/reports', '/demo/imports', '/login']
    for (const url of paths) {
      await page.goto(url)
      await expect(page.locator('h1')).toBeVisible()
      if (url === '/demo/reconciliation') await expect(page.locator('tbody tr').first()).toBeVisible()
      if (url.includes('case=')) await expect(page.locator('.evidence-record').first()).toBeVisible()
      if (url === '/demo/investigations') await expect(page.getByRole('button', { name: /^Investigate / }).first()).toBeVisible()
      const layout = await page.evaluate(() => {
        const tiny = Array.from(document.querySelectorAll('h1,h2,h3,p,th,td,label,button,a,small,summary')).filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.classList.contains('sr-only') && parseFloat(getComputedStyle(element).fontSize) < 12).map(element => ({ text: element.textContent?.slice(0, 40), size: getComputedStyle(element).fontSize }))
        const luminance = (color: string) => {
          const values = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
          return values[0] * .2126 + values[1] * .7152 + values[2] * .0722
        }
        const lowContrast = Array.from(document.querySelectorAll('.badge,.severity,.footnote,label,th,td,.warning-text,.public-review-result dd')).filter(element => element.getClientRects().length && !element.closest(':disabled')).flatMap(element => {
          const style = getComputedStyle(element)
          let parent: Element | null = element
          let background = 'rgb(255, 255, 255)'
          while (parent) {
            const candidate = getComputedStyle(parent).backgroundColor
            if (candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') { background = candidate; break }
            parent = parent.parentElement
          }
          const a = luminance(style.color), b = luminance(background)
          const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
          const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.67 && Number(style.fontWeight) >= 700
          return ratio < (large ? 3 : 4.5) ? [{ text: element.textContent?.slice(0, 40), ratio }] : []
        })
        return { viewport: innerWidth, document: document.documentElement.scrollWidth, tiny, lowContrast }
      })
      expect(layout.document, url).toBeLessThanOrEqual(width)
      expect(layout.tiny, url).toEqual([])
      expect(layout.lowContrast, url).toEqual([])
      if (url !== '/login') await page.screenshot({ path: `test-results/refined-${width}-${url === '/' ? 'landing' : url.includes('case=') ? 'case' : url.split('/').pop()}.png`, fullPage: true })
    }
    if (width <= 768) {
      await page.goto('/demo/dashboard')
      await page.getByRole('button', { name: 'Menu', exact: true }).click()
      await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Reconciliation', exact: true }).click()
      await expect(page.getByRole('tab', { name: 'Review cases 54' })).toBeVisible()
    }
  })
}
