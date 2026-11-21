# FactoryFlow

Mini ERP module for a fermentation factory. It follows raw materials from purchase request to approval,
receipt, inventory lot and fermentation batch, so every batch can be traced back to the lots it used.

> Work in progress: backend done, frontend and AI features coming next.

## What it does
- **Roles:** Requester, Approver, Store, Admin, each with different permissions (RBAC with JWT)
- **Purchase workflow:** request -> approve / reject -> receive (receiving creates an inventory lot)
- **Lot-based inventory:** quantity and expiry tracked per lot, expired lots are never used
- **Batches:** raw materials are consumed FEFO (first-expiry-first-out) inside one database transaction
- **Traceability:** enter a lot number, see every batch that used it (and the reverse for a batch)
- **Dashboard API:** low stock, expiring lots, pending approvals, yield per batch
- **Daily job:** a scheduled check writes low-stock and expiry alerts
- **Audit trail:** every state change records who did what, and when

## Run locally
Requirements: Node.js 20+, and PostgreSQL (or Docker).

```bash
docker compose up -d              # starts PostgreSQL (skip if you have your own)
cd server
cp .env.example .env              # then set JWT_SECRET
npm install
npm run db:reset                  # creates tables and loads demo data
npm run dev                       # API on http://localhost:4000
npm test                          # 19 tests
```

Demo logins (password `Demo@123`): `requester@`, `approver@`, `store@`, `admin@factoryflow.dev`

## Design decisions
- **Raw SQL with `pg`** instead of an ORM, so transactions and row locks are explicit.
- **Stock deduction is atomic:** `SELECT ... FOR UPDATE` locks the lots, so two batches racing for the same
  stock cannot both succeed. There is a test for exactly this.
- **Segregation of duties:** nobody can approve their own purchase request.
- **Validation with Zod** on every input; one central error handler; login rate limiting.

## Roadmap
React frontend, AI-assisted purchase form, deployment.
