-- FactoryFlow database schema (PostgreSQL)
-- WARNING: this file drops and recreates everything. Used by `npm run db:reset` and by the tests.

DROP TABLE IF EXISTS alerts, audit_log, batch_lots, batches, lots, purchase_requests, items, users CASCADE;
DROP SEQUENCE IF EXISTS batch_seq;
DROP TYPE IF EXISTS user_role, request_status, batch_status;

CREATE TYPE user_role      AS ENUM ('requester', 'approver', 'store', 'admin');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'received');
CREATE TYPE batch_status   AS ENUM ('running', 'completed');

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw materials (carbon source, nitrogen source, salts, ...)
CREATE TABLE items (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  category      TEXT NOT NULL DEFAULT 'General',
  unit          TEXT NOT NULL,                       -- kg, L
  reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workflow: pending -> approved -> received   (or pending -> rejected)
CREATE TABLE purchase_requests (
  id            SERIAL PRIMARY KEY,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  quantity      NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  needed_by     DATE,
  reason        TEXT,
  status        request_status NOT NULL DEFAULT 'pending',
  requested_by  INTEGER NOT NULL REFERENCES users(id),
  decided_by    INTEGER REFERENCES users(id),
  decided_at    TIMESTAMPTZ,
  decision_note TEXT,
  received_by   INTEGER REFERENCES users(id),
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pr_status ON purchase_requests(status);
CREATE INDEX idx_pr_requested_by ON purchase_requests(requested_by);

-- A lot = one received delivery of one item. Stock is tracked per lot.
CREATE TABLE lots (
  id                  SERIAL PRIMARY KEY,
  lot_number          TEXT NOT NULL UNIQUE,
  item_id             INTEGER NOT NULL REFERENCES items(id),
  purchase_request_id INTEGER REFERENCES purchase_requests(id),
  supplier            TEXT,
  quantity_received   NUMERIC(12,3) NOT NULL CHECK (quantity_received > 0),
  quantity_remaining  NUMERIC(12,3) NOT NULL,
  expiry_date         DATE,
  received_by         INTEGER REFERENCES users(id),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_received)
);
CREATE INDEX idx_lots_item_expiry ON lots(item_id, expiry_date);

CREATE SEQUENCE batch_seq START 1;

-- A fermentation batch (one run of a strain in the fermenter)
CREATE TABLE batches (
  id          SERIAL PRIMARY KEY,
  batch_code  TEXT NOT NULL UNIQUE,
  strain      TEXT NOT NULL,
  status      batch_status NOT NULL DEFAULT 'running',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  yield_kg    NUMERIC(12,3) CHECK (yield_kg IS NULL OR yield_kg >= 0),
  notes       TEXT,
  created_by  INTEGER NOT NULL REFERENCES users(id)
);

-- Which lots (and how much of each) went into which batch. This table powers traceability.
CREATE TABLE batch_lots (
  id            SERIAL PRIMARY KEY,
  batch_id      INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  lot_id        INTEGER NOT NULL REFERENCES lots(id),
  quantity_used NUMERIC(12,3) NOT NULL CHECK (quantity_used > 0),
  UNIQUE (batch_id, lot_id)
);
CREATE INDEX idx_batch_lots_lot ON batch_lots(lot_id);

-- Who did what, and when
CREATE TABLE audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Written by the daily scheduled job (low stock / expiring lots)
CREATE TABLE alerts (
  id         SERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,
  ref        TEXT NOT NULL,
  message    TEXT NOT NULL,
  alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, ref, alert_date)
);
