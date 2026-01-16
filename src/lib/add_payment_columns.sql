-- Add PortOne payment identifier columns to the payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS imp_uid TEXT,
ADD COLUMN IF NOT EXISTS merchant_uid TEXT;

-- Optional: Add index for faster lookups on these columns
CREATE INDEX IF NOT EXISTS idx_payments_imp_uid ON payments(imp_uid);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_uid ON payments(merchant_uid);

-- Comment
COMMENT ON COLUMN payments.imp_uid IS 'PortOne unique payment ID';
COMMENT ON COLUMN payments.merchant_uid IS 'Merchant unique order ID';
