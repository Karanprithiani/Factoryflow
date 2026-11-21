# FactoryFlow – Assumptions & Design Decisions

This file documents every decision made where the spec was ambiguous.
Written during Part 1 (Phases 1–3) of the build.

---

## Phase 1 – Backend

### A1 – Test safety check uses either TEST_DATABASE_URL or DATABASE_URL
The spec says "if the database name in DATABASE_URL does not contain 'test', throw".
The vitest config already swaps in TEST_DATABASE_URL when it exists, so we check
`TEST_DATABASE_URL` first, then fall back to `DATABASE_URL`. This means you can
safely run `npm test` as long as either variable points to a database with "test"
in its name.

---

## Phase 2 – Frontend

### A2 – Tailwind CSS v3 used (not v4)
The official Vite + Tailwind guide for the React template uses v3.
v4 (alpha) has a different setup process. We stay on the stable v3.

### A3 – Sidebar navigation items are role-gated at render time
The sidebar conditionally renders links based on the logged-in user's role.
Navigating directly to a guarded URL is blocked by the ProtectedRoute component,
which redirects to /login if the user is not authenticated or to / if the role is wrong.

### A4 – "Receive" form pre-fills quantity from the purchase request
The store person can override the received quantity (partial deliveries happen in real life).

### A5 – Lot number on the Receive form is optional
If the store person leaves the lot number blank, the server generates one automatically.
We show whatever lot number comes back from the POST /receive response.

### A6 – The "New Batch" form uses an item dropdown + quantity per row
The spec says "a list of rows (item dropdown + quantity) with 'Add another material'".
We start with one row and let the user add more. The minimum is one material.

### A7 – The traceability page at /trace shows an empty search box on first load
Navigating to /trace/:lotNumber pre-fills the search box and immediately loads results.
This matches how most traceability tools work (bookmarkable direct links).

### A8 – Date formatting uses the browser's Intl API
Dates are formatted as "12 Dec 2026" using `new Intl.DateTimeFormat('en-GB', ...)`.
This is consistent with the spec's example and works without any date library.

### A9 – The dashboard "Run daily check" button is visible only to admins
The spec says "Admin only: button 'Run daily check now'". All other users see the same
dashboard data but do not see this button.

### A10 – Admin can create a purchase request but the server blocks self-approval
If an admin creates a request and then tries to approve it, the server returns a 409
with a clear message. The frontend shows that exact server message in a red banner.

### A11 – Recharts bar chart uses ResponsiveContainer for mobile friendliness
The chart fills its parent div width. On small screens the sidebar collapses to a
top nav so the chart has full width.

### A12 – Empty lot number field on batch allocation table shows "auto-assigned"
When no lot number was given during receive, the server assigns one. We always
display whatever comes back from the API.

---

## Running the App

```bash
# Terminal 1 – backend
cd server
npm install
npm run db:reset
npm run dev        # API at http://localhost:4000

# Terminal 2 – frontend
cd client
npm install
npm run dev        # UI at http://localhost:5173
```

Demo credentials (password: `Demo@123`):
| Email | Role |
|---|---|
| requester@factoryflow.dev | REQUESTER |
| approver@factoryflow.dev | APPROVER |
| store@factoryflow.dev | STORE |
| admin@factoryflow.dev | ADMIN |
