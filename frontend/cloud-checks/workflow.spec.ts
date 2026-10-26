import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

test('hosted Cognito sign-in, synthetic imports, PostgreSQL reconciliation, review, AI, export, and sign-out', async ({ page }) => {
  const outputs = JSON.parse(await readFile(path.resolve('../deploy/.local/outputs.json'), 'utf8'))
  const credentials = JSON.parse(await readFile(path.resolve('../deploy/.local/operator-access.json'), 'utf8'))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const denied = await page.request.get('/api/workspace')
  expect(denied.status()).toBe(401)
  await page.goto('/imports')
  await expect(page.getByRole('heading', { name: 'Sign in to ReconcileOS', exact: true })).toBeVisible()
  // Use the native setter so React receives input without persisting credential values in action logs.
  await page.evaluate(({ username, password }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    for (const [name, value] of Object.entries({ username, password })) {
      const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
      if (name === 'password') input.setAttribute('aria-hidden', 'true')
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, { username: credentials.username, password: credentials.password })
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Imports', exact: true })).toBeVisible()

  async function api(pathname: string) {
    return page.evaluate(async pathname => {
      const current = JSON.parse(sessionStorage.getItem('reconcileos.auth.session') || 'null')
      if (!current?.access_token) throw new Error('The browser session is unavailable.')
      const response = await fetch('/api' + pathname, { headers: { Authorization: 'Bearer ' + current.access_token } })
      return { status: response.status, body: await response.json() }
    }, pathname)
  }
  const workspace = await api('/workspace')
  expect(workspace.status).toBe(200)
  expect(workspace.body.mode).toBe('aws')
  expect(workspace.body.operator.startsWith('cognito:')).toBe(true)
  expect(workspace.body.fee_configuration.rules).toEqual({})
  const sourceRoot = path.resolve('../sample-data/cloud-demo')
  const sources = ['orders', 'payments', 'settlements']
  const checksums = await Promise.all(sources.map(async source => createHash('sha256').update(await readFile(path.join(sourceRoot, source + '.csv'))).digest('hex')))
  const history = await api('/imports?page_size=100')
  expect(history.status).toBe(200)
  expect(history.body.total <= 3 && history.body.items.every((item: { checksum: string }) => checksums.includes(item.checksum)), 'This verification only adds synthetic files to an empty workspace or resumes its own files.').toBe(true)
  for (const source of sources) {
    await page.getByLabel('Record type').selectOption(source)
    await page.getByLabel('Select a file').setInputFiles(path.join(sourceRoot, source + '.csv'))
    await page.getByRole('button', { name: 'Preview file', exact: true }).click()
    await expect(page.locator('.preview-panel').getByText(source + '.csv', { exact: true })).toBeVisible()
    const confirmation = page.getByRole('button', { name: 'Confirm import', exact: true })
    if (await confirmation.count()) await confirmation.click()
    await expect(page.getByRole('button', { name: 'Imported', exact: true })).toBeVisible()
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Reconciliation', exact: true }).click()
  const runResponse = page.waitForResponse(response => response.url().endsWith('/api/runs') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Start reconciliation', exact: true }).click()
  const response = await runResponse
  expect(response.status()).toBe(200)
  const run = await response.json()
  const expected = JSON.parse(await readFile(path.join(sourceRoot, 'expected-results.json'), 'utf8'))
  expect(run.original_summary).toEqual(expected.summary)
  await expect(page.getByRole('tab', { name: 'Review cases 2', exact: true })).toBeVisible()
  await expect(page.getByText('GHS 125.50', { exact: true }).first()).toBeVisible()

  await page.getByRole('link', { name: 'Investigations', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search investigation references' }).fill('SYN-CLOUD-002')
  await page.getByRole('button', { name: /^Investigate / }).click()
  const panel = page.locator('.case-panel')
  const reason = page.getByRole('textbox', { name: 'Reason or investigation note' })
  await reason.fill('Verified synthetic source records through the hosted application.')
  await panel.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(panel.locator('.history-entry').filter({ hasText: 'Verified synthetic source records' }).first()).toBeVisible()
  await reason.fill('Synthetic demonstration disposition; payment remains unsupported.')
  await panel.getByRole('button', { name: 'Resolve case', exact: true }).click()
  await expect(panel.locator('.case-status .badge')).toHaveText('resolved')
  await reason.fill('Reopened for continued synthetic evidence review.')
  await panel.getByRole('button', { name: 'Reopen case', exact: true }).click()
  await expect(panel.locator('.case-status .badge')).toHaveText('reopened')
  const caseId = new URL(page.url()).searchParams.get('case')!
  const before = await api(`/investigations/${caseId}`)
  expect(before.body.audit_history.length).toBeGreaterThanOrEqual(3)
  expect(before.body.audit_history.every((event: { actor: string }) => event.actor === workspace.body.operator)).toBe(true)

  if (process.env.HOSTED_VERIFY_AI === '1') {
    expect(workspace.body.ai.available).toBe(true)
    await expect(page.getByRole('button', { name: 'Request AI assistance', exact: true })).toBeDisabled()
    await page.getByRole('checkbox', { name: "Send this case's selected evidence to the configured provider for a hypothesis." }).check()
    const aiResponse = page.waitForResponse(response => response.url().endsWith(`/investigations/${caseId}/ai`) && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Request AI assistance', exact: true }).click()
    expect((await aiResponse).status()).toBe(200)
    await expect(panel.getByRole('heading', { name: 'Saved AI investigation' }).first()).toBeVisible()
    const after = await api(`/investigations/${caseId}`)
    expect(after.body.status).toBe(before.body.status)
    expect(after.body.snapshot_hash).toBe(before.body.snapshot_hash)
    const recordedRun = await api(`/runs/${run.id}`)
    expect(recordedRun.body.original_summary).toEqual(expected.summary)
    expect(recordedRun.body.current_summary).toEqual(expected.summary)
  }
  await page.reload()
  await expect(panel.locator('.history-entry').filter({ hasText: 'Reopened for continued synthetic evidence review.' }).first()).toBeVisible()
  await page.getByRole('link', { name: 'Reports', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export summary CSV', exact: true }).click()
  const saved = await download
  expect(await readFile((await saved.path())!, 'utf8')).toContain('matched_order_value,GHS,12550,125.50')
  await page.screenshot({ path: '../deploy/.local/hosted-reports.png', fullPage: true })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to ReconcileOS', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('reconcileos.auth.session') === null)).toBe(true)
  expect(errors).toEqual([])
})
