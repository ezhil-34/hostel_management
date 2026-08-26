-- The three tables the points module has always needed and never had.
--
-- `PaymentPin`, `PointsQrCode` and `WalletTransaction` were declared in
-- schema.prisma but no migration ever created them, so every wallet call failed
-- against a database that had no such tables. This adds them, and nothing else.

CREATE TYPE "PointsQrStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED');

-- One spending PIN per person, hashed.
CREATE TABLE "payment_pins" (
    "id"         UUID         NOT NULL,
    "user_id"    UUID         NOT NULL,
    "pin_hash"   TEXT         NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_pins_user_id_key" ON "payment_pins"("user_id");

-- A payment request an admin generates; the student scans its token to pay.
CREATE TABLE "points_qr_codes" (
    "id"            UUID             NOT NULL,
    "reference"     TEXT             NOT NULL,
    "token"         TEXT             NOT NULL,
    "wallet_type"   "WalletType"     NOT NULL,
    "amount"        INTEGER          NOT NULL,
    "title"         TEXT             NOT NULL,
    "status"        "PointsQrStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID             NOT NULL,
    "paid_by_id"    UUID,
    "paid_at"       TIMESTAMP(3),
    "expires_at"    TIMESTAMP(3)     NOT NULL,
    "created_at"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_qr_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "points_qr_codes_reference_key" ON "points_qr_codes"("reference");
CREATE UNIQUE INDEX "points_qr_codes_token_key" ON "points_qr_codes"("token");
CREATE INDEX "points_qr_codes_status_idx" ON "points_qr_codes"("status");
CREATE INDEX "points_qr_codes_created_by_id_idx" ON "points_qr_codes"("created_by_id");

-- The ledger: one row per movement, carrying the balance it left behind.
CREATE TABLE "wallet_transactions" (
    "id"            UUID         NOT NULL,
    "wallet_id"     UUID         NOT NULL,
    "user_id"       UUID         NOT NULL,
    "type"          TEXT         NOT NULL,
    "amount"        INTEGER      NOT NULL,
    "balance_after" INTEGER      NOT NULL,
    "title"         TEXT         NOT NULL,
    "qr_code_id"    UUID,
    "created_by_id" UUID,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_transactions_qr_code_id_key" ON "wallet_transactions"("qr_code_id");
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at");

ALTER TABLE "payment_pins"
  ADD CONSTRAINT "payment_pins_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "points_qr_codes"
  ADD CONSTRAINT "points_qr_codes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "points_qr_codes"
  ADD CONSTRAINT "points_qr_codes_paid_by_id_fkey"
  FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_qr_code_id_fkey"
  FOREIGN KEY ("qr_code_id") REFERENCES "points_qr_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
