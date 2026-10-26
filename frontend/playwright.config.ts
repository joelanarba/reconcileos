import { defineConfig } from '@playwright/test'
import path from 'node:path'

const backendPython = path.resolve('../backend/.venv/Scripts/python.exe')
const migrationConfig = path.resolve('../backend/alembic.ini')
const backendDirectory = path.resolve('../backend')
const verificationId = Date.now()
const demoDatabase = path.resolve(`../backend/data/browser-demo-${verificationId}.db`)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: `"${backendPython}" -m alembic -c "${migrationConfig}" upgrade head && "${backendPython}" "${backendDirectory}/prepare_demo.py" --database-path "${demoDatabase}" && "${backendPython}" -m uvicorn app.main:app --app-dir "${backendDirectory}" --host 127.0.0.1 --port 8011`,
      url: 'http://127.0.0.1:8011/api/health',
      env: { DATABASE_URL: `sqlite:///${path.resolve(`../backend/data/browser-check-${verificationId}.db`).replaceAll('\\', '/')}`, PUBLIC_DEMO_DATABASE_URL: `sqlite:///${demoDatabase.replaceAll('\\', '/')}`, FEE_RULES_PATH: path.resolve('../sample-data/fee-rules.json'), CORS_ORIGINS: '["http://127.0.0.1:5174"]' },
      reuseExistingServer: false,
    },
    {
      command: 'npm.cmd run dev -- --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8011/api' },
      reuseExistingServer: false,
    },
  ],
})
