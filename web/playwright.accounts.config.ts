import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the hosted product (accounts on): the account service runs locally with SQLite,
 * the fake payment provider and test sign-in, behind a build of the app made with VITE_ACCOUNTS=on.
 *   npm run e2e:accounts
 */
const WEB = 4174;
const API = 8787;
const RUN = `/tmp/mathme-e2e-${process.pid}`;
const PY = process.env.ACCOUNT_SERVICE_PYTHON ?? '../account-service/.venv/bin/python';

export default defineConfig({
  testDir: './e2e-accounts',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB}`,
    storageState: {
      cookies: [],
      origins: [
        { origin: `http://localhost:${WEB}`, localStorage: [{ name: 'mathme.tour.done', value: '1' }] },
      ],
    },
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: [
    {
      command: `${PY} -m uvicorn account_service.app:app --app-dir ../account-service/src --port ${API}`,
      url: `http://localhost:${API}/api/plans`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PUBLIC_URL: `http://localhost:${WEB}`,
        PAYMENTS: 'fake',
        AUTH_TEST_LOGIN: '1',
        COOKIE_SECURE: '0',
        OWNER_EMAILS: 'owner@mathme.app',
        DB_PATH: `${RUN}.sqlite3`,
        BUCKET_DIR: `${RUN}-bucket`,
        SELLER_STATE: 'Karnataka',
        SELLER_GSTIN: '29ABCDE1234F1Z5',
        GEOMETRY_ORIGIN: 'http://localhost:8000',
      },
    },
    {
      command: `npx vite build --outDir dist-accounts && npx vite preview --outDir dist-accounts --port ${WEB} --strictPort`,
      port: WEB,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_ACCOUNTS: 'on', ACCOUNT_SERVICE_URL: `http://localhost:${API}` },
    },
  ],
});
