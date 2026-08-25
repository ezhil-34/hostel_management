-- Points module: counters, menus, PIN lockout, and a ledger that adds up.
--
-- Written by hand rather than generated, because `reference` and `balance_after`
-- are NOT NULL on a table that already has rows. The generated version refuses
-- to run for exactly that reason. Each column is therefore added nullable,
-- backfilled, and only then made required — which works on an empty database
-- and on one with a year of history.

-- ---------------------------------------------------------------------------
-- wallets: PIN lockout state
-- ---------------------------------------------------------------------------
ALTER TABLE "wallets"
  ADD COLUMN "pin_attempts"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pin_locked_until" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- point_transactions: receipts, snapshots, and the running balance
-- ---------------------------------------------------------------------------
ALTER TABLE "point_transactions"
  ADD COLUMN "reference"     TEXT,
  ADD COLUMN "counter_name"  TEXT,
  ADD COLUMN "actor_name"    TEXT,
  ADD COLUMN "note"          TEXT,
  ADD COLUMN "balance_after" INTEGER;

-- A receipt code for every row that predates them.
UPDATE "point_transactions"
SET "reference" = 'PTS-' || upper(substr(md5(random()::text || "id"::text), 1, 6))
WHERE "reference" IS NULL;

-- Reconstruct the balance each historical row left behind.
--
-- The opening balance is unknowable — the old seed set a wallet to 450 and
-- recorded debits without the credit that funded them, so the ledger does not
-- add up on its own. What IS known is where each wallet stands now, so the
-- balance is walked backwards from there: a row's balance_after is the wallet's
-- current balance minus every movement that came after it. The newest row
-- therefore lands exactly on the current balance, and each older row is
-- consistent with the one after it.
WITH calc AS (
  SELECT
    t."id",
    w."balance" - COALESCE(
      SUM(CASE WHEN t."type" = 'CREDIT' THEN t."points" ELSE -t."points" END)
        OVER (PARTITION BY t."wallet_id"
              ORDER BY t."created_at", t."id"
              ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING),
      0
    ) AS "balance_after"
  FROM "point_transactions" t
  JOIN "wallets" w ON w."id" = t."wallet_id"
)
UPDATE "point_transactions" pt
SET "balance_after" = calc."balance_after"
FROM calc
WHERE calc."id" = pt."id";

ALTER TABLE "point_transactions"
  ALTER COLUMN "reference"     SET NOT NULL,
  ALTER COLUMN "balance_after" SET NOT NULL;

CREATE UNIQUE INDEX "point_transactions_reference_key" ON "point_transactions"("reference");

-- ---------------------------------------------------------------------------
-- counters and their menus
-- ---------------------------------------------------------------------------
CREATE TABLE "counters" (
  "id"         UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "type"       "WalletType" NOT NULL,
  "qr_token"   TEXT         NOT NULL,
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "counters_qr_token_key" ON "counters"("qr_token");

CREATE TABLE "menu_items" (
  "id"           UUID         NOT NULL,
  "counter_id"   UUID         NOT NULL,
  "name"         TEXT         NOT NULL,
  "points"       INTEGER      NOT NULL,
  "is_available" BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "menu_items_counter_id_idx" ON "menu_items"("counter_id");

ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_counter_id_fkey"
  FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
