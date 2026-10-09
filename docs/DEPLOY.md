# Deploying MathMe with accounts, plans and payments

The hosted product has three parts:

| Part | Where | What it does |
|---|---|---|
| Web app + landing page | Cloudflare Worker static assets (`web/dist`) | The studio, the home page, the pricing page |
| Account service | Cloudflare **Python Worker** (`account-service/`) with **D1** and **R2** | Sign-in, cloud projects, plans and limits, Cashfree billing, GST invoices, Campus licences, owner dashboard |
| Geometry service | Any Docker host (`geometry-service/`) | Measurements, join/cut, print-ready files, the heart slicer, the AI chat helper |

The browser only ever talks to the Worker (same site, `/api/*`). The Worker checks the user's plan and
quotas, then forwards geometry and AI requests to the container with a shared secret.

Everything below needs your own accounts (Cloudflare, Google Cloud, Cashfree, Resend). Nothing here can
be done from the code repository alone.

## 1. Before you start

- A domain on Cloudflare, e.g. `mathme.app`.
- Node 22 and [uv](https://docs.astral.sh/uv/) **0.12.3 or newer** (`uv self update`).
- The business details for GST invoices: legal name, address, state, GSTIN.

## 2. Cloudflare: database, storage, Worker

```bash
cd account-service
npx wrangler login
npx wrangler d1 create mathme              # copy the database_id into wrangler.toml
npx wrangler r2 bucket create mathme-projects
npx wrangler d1 migrations apply mathme --remote
```

Edit `wrangler.toml`: `database_id`, `PUBLIC_URL`, `SELLER_STATE`, `GEOMETRY_ORIGIN`, `EMAIL_FROM`,
`SUPPORT_EMAIL`. Then add the secrets (each command asks for the value):

```bash
for s in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET CASHFREE_CLIENT_ID CASHFREE_CLIENT_SECRET \
         CASHFREE_WEBHOOK_SECRET RESEND_API_KEY GEOMETRY_SECRET OWNER_EMAILS SELLER_GSTIN SELLER_ADDRESS; do
  npx wrangler secret put $s
done
```

`OWNER_EMAILS` is a comma-separated list of the Google accounts that may open the owner dashboard
(`https://mathme.app/#admin`).

Build the web app with accounts switched on, then deploy the Worker (it serves `web/dist` too):

```bash
cp ../shared/plans.json src/account_service/plans.json   # keep the service's copy in step
(cd ../web && npm ci && VITE_ACCOUNTS=on npm run build)
uv run --with workers-py pywrangler deploy
```

**Test the Worker first.** The account service is tested locally with SQLite and fake providers
(`pytest`, `npm run e2e:accounts`). The Cloudflare adapters (`D1Db`, `R2Bucket`, `WorkersHttp` in
`account-service/src/account_service/`) only run inside Cloudflare. Check them on a preview deploy before
real customers arrive:

1. `uv run --with workers-py pywrangler dev`, then open the printed address.
2. Sign in, save a project, open it on a second browser, export, and run a Cashfree sandbox payment.
3. Watch `npx wrangler tail` for errors.

## 3. Google sign-in

1. Google Cloud console → APIs & Services → **OAuth consent screen**: External, app name "MathMe", support
   email, your domain, and links to `/landing/privacy.html` and `/landing/terms.html`.
2. Credentials → **Create OAuth client ID** → Web application.
   - Authorised redirect URI: `https://mathme.app/api/auth/google/callback`
3. Put the client ID and secret into the Worker secrets (step 2).
4. While the consent screen is in "Testing", add your test users. Publish it before launch.

## 4. Cashfree (payments)

1. Sign up at Cashfree Payments and complete KYC.
   - Activation needs the live **Terms**, **Privacy**, **Refund & Cancellation** and **Contact** pages. Drafts
     are in `web/landing/` (`terms.html`, `privacy.html`, `refunds.html`, `contact.html`, served at
     `https://mathme.app/landing/…`).
     - Fill in everything in [square brackets]: registered address, phone, GSTIN, grievance officer, the city
       for jurisdiction, and the geometry host.
     - Decide the refund window (the draft offers 7 days on a first yearly purchase).
     - Have a lawyer review them, then remove the yellow "Draft for review" note at the top of each page.
   - Enable **Subscriptions** (UPI AutoPay, cards, eNACH) and **Payment Links** for your account.
2. Start in the **sandbox** (`CASHFREE_ENV = "sandbox"` in `wrangler.toml`) with sandbox keys.
3. Dashboard → Developers → **Webhooks**: add `https://mathme.app/api/billing/webhook/cashfree` for
   payments, subscriptions and payment links. Use the latest webhook version.
4. Set `CASHFREE_WEBHOOK_SECRET` to the key Cashfree signs webhooks with. Cashfree's documentation names
   either the client secret or a separate webhook secret, depending on the product. If webhooks are
   refused with "Bad signature", try the other.
5. **Check these against the sandbox before going live.** They follow Cashfree's API version 2025-01-01
   documentation, but could not be tried without an account:
   - Monthly subscriptions:
     - Field names in `cashfree.py` → `create_subscription`.
     - The first month is charged when the mandate is authorised (`authorization_amount` = the monthly
       price), and the first scheduled debit is a month later.
   - The webhook payloads that `parse_event` reads:
     - `SUBSCRIPTION_PAYMENT_SUCCESS` / `_FAILED`
     - `SUBSCRIPTION_STATUS_CHANGED`
     - `SUBSCRIPTION_AUTH_STATUS`
     - `PAYMENT_SUCCESS_WEBHOOK`
     - `PAYMENT_LINK_EVENT`
   - The browser SDK calls `cashfree.subscriptionsCheckout({ subsSessionId })` and
     `cashfree.checkout({ paymentSessionId })` in `web/src/account/PricingModal.tsx`.
6. Switch to production: `CASHFREE_ENV = "production"`, production keys, production webhook.

Prices are stored **before GST** in `shared/plans.json` (in paise). 18% GST is added at checkout:
- **CGST + SGST** when the buyer's state is `SELLER_STATE`.
- **IGST** otherwise.

Invoices are numbered per financial year (`MM/2026-27/000001`) and use SAC 997331. Ask your accountant to
confirm the SAC code and the invoice wording.

## 5. Resend (email)

1. Add and verify your sending domain in Resend (DNS records on Cloudflare).
2. Create an API key → `RESEND_API_KEY`. Set `EMAIL = "resend"` and `EMAIL_FROM`.

Emails sent:
- receipts after each payment
- reminders 15 and 3 days before a yearly plan ends (a daily Cron Trigger at 06:00 IST)
- Campus and Enterprise enquiry alerts to `OWNER_EMAILS`

## 6. Geometry service

Run `geometry-service/Dockerfile` on any container host (Cloudflare Containers, Fly.io, Render,
Railway…):

```bash
GEOMETRY_SECRET=<same value as the Worker secret>
ALLOWED_ORIGINS=https://mathme.app
ANTHROPIC_API_KEY=<optional: turns on the AI chat helper>   # pip install -e .[ai] in the image
```

With `GEOMETRY_SECRET` set, the container refuses any request that does not come through the Worker, so
nobody can skip the plan quotas. Point `GEOMETRY_ORIGIN` in `wrangler.toml` at the container.

## Safety switches

- `AUTH_TEST_LOGIN=1` (sign in without Google) and `PAYMENTS = "fake"` (the pretend checkout) only work when
  `PUBLIC_URL` is `localhost`. On a real address they are refused, so a forgotten setting cannot give anyone
  owner access or a free plan.
- Keep `PAYMENTS = "cashfree"` in `wrangler.toml`. Until Cashfree is set up, checkout answers "Payments are
  not switched on yet".

## 7. After launch

- **Owner dashboard:** `https://mathme.app/#admin`. It shows sign-ups, weekly active users, paying users,
  free-to-paid conversion, MRR, 30-day churn and revenue (before GST), Campus enquiries and licences, and
  the revenue scenario calculator.
- **Campus pilots:**
  1. An enquiry arrives → **Start pilot** creates a licence (100 students + 5 teachers) with teacher and
     student join codes.
  2. Send the codes to the school.
  3. When they pay, either **Mark paid** (bank transfer, with the UTR number) or send a Cashfree payment
     link. Both issue a GST invoice.
- **Changing prices or limits:**
  1. Edit `shared/plans.json`, and copy it to `account-service/src/account_service/plans.json`.
  2. Update the landing page prices (`web/landing/index.html`, the `data-price` spans).
  3. Run the tests, which check that all three match.
  4. Redeploy.
- **Backups:** D1 has Time Travel (point-in-time restore for 30 days). R2 keeps the project files.

## Not in this round (Phase 2 and later)

- assignments for Campus classes
- seat top-ups
- prorated plan changes (an upgrade starts a new plan; the old one stops renewing and runs out)
- generation credits
- the marketplace
- the developer API
