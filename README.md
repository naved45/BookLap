# BookLoop

Read it. Swap it. Sell it. Repeat it. MERN app, mobile-first.

```
bookloop/
  frontend/   React + Vite (port 5173)
  backend/    Node + Express + Mongoose API (port 4000)
```

## Run locally
Prereqs: Node 20+, MongoDB running locally (or an Atlas URI).
```bash
cd backend && cp .env.example .env     # set JWT_SECRET
npm install && npm run seed && npm run dev
cd ../frontend && npm install && npm run dev
```
Open http://localhost:5173. Seed logins (password `demo-password-1`): demo.reader1@example.com, demo.reader2@example.com, demo.admin@example.com.

**On your phone:** run `npm run dev -- --host` in frontend, open `http://<your-PC-LAN-IP>:5173`, and set `CLIENT_ORIGIN` in backend/.env to that same URL.

**Emails (dev):** no email provider is connected. Verification and reset links are written to `backend/.dev-outbox.log` instead of being sent. In production, sending fails until you add a provider in `backend/src/mailer.js`.

## Works like a phone app (PWA)
Installable web app: icon on the home screen, full-screen with no browser bar, bottom tab bar, offline-friendly shell, safe-area spacing for notches. On Android/Chrome an Install button appears; on iPhone use Share → Add to Home Screen. Installing requires HTTPS (any real host) or localhost. The service worker only runs in a production build: `cd frontend && npm run build && npm run preview`. It is a web app, not an App Store/Play Store app.

## Screen sizes
One codebase adapts: phones (bottom tab bar, 2-3 book columns), tablets (top nav, 3 columns), laptops (4 columns, wide hero, hover effects) and large monitors (5 columns). Tested by the Playwright projects: laptop 1366px, tablet, Pixel 7, iPhone SE.

## Tests
- Backend: `cd backend && npm test` (in-memory MongoDB; first run downloads a binary), `npm audit`.
- Browser (needs both servers running): `cd frontend && npx playwright install && npm run e2e` (desktop + Pixel 7 phone).

## Built
Auth with hashed passwords, httpOnly cookie, per-IP and per-account backoff; email verification and password reset (single-use, expiring tokens); onboarding; listings with search, filters, sort, paging, wishlist and photo upload (content-checked, stored outside the web root); swaps with counteroffers, atomic reservation and two-party completion; orders with server-side price snapshot; messages (polling), notifications, reviews, public profiles, blocking, reports, community groups and posts; admin overview, users, reports queue and audit log; strict validation, configurable rate limits, helmet, CORS, generic errors; Dockerfile for the backend.

## Payments (backend ready, not live)
`POST /api/v1/payments/checkout` and a signature-verified, idempotent `POST /api/v1/payments/webhook` (Razorpay) exist in the backend. They activate only when `RAZORPAY_*` keys are set; otherwise checkout answers "not set up". The frontend has no pay button yet, so purchases are still settled directly between users. The gateway calls have not been exercised against Razorpay's test mode.

## Not built
Socket.IO live chat (polling is used), frontend pay button, admin category management, production image storage (S3/Cloudinary), CI and hosting config beyond the Dockerfile.

## Known limits
Written without network access: not installed, built or test-run. Expect small fixes on first run. Privacy and terms pages are drafts to review before a public launch.
"# BookLap" 
