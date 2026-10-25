import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const outputs = JSON.parse(readFileSync(path.resolve('../deploy/.local/outputs.json'), 'utf8'))
if (!/^https:\/\/[a-z0-9]+\.cloudfront\.net$/.test(outputs.AppUrl)) throw new Error('The hosted check requires the reviewed CloudFront origin.')

export default defineConfig({
  testDir: './cloud-checks',
  globalTeardown: './cloud-checks/redact.ts',
  workers: 1,
  reporter: 'list',
  timeout: 180000,
  expect: { timeout: 20000 },
  outputDir: '../deploy/.local/browser-check',
  use: { baseURL: outputs.AppUrl, channel: 'msedge', headless: true, actionTimeout: 30000, navigationTimeout: 40000, viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'off', video: 'off' },
})
