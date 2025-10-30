-- Fix payment_method constraint to allow bank_transfer for income transactions
-- The current constraint is too restrictive

-- First, drop the existing constraint if it exists
ALTER TABLE IF EXISTS transactions 
DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

-- Add new constraint that allows proper payment methods
-- Include all valid payment methods from the system
ALTER TABLE transactions
ADD CONSTRAINT transactions_payment_method_check
CHECK (
  payment_method IN (
    'cash',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'digital_wallet',
    'check',
    'paypal',
    'bit',
    'paybox',
    'direct_debit',
    'standing_order',
    'other'
  )
);

-- Add comment for documentation
COMMENT ON CONSTRAINT transactions_payment_method_check ON transactions IS 
'Valid payment methods: cash, credit_card, debit_card, bank_transfer, digital_wallet, check, paypal, bit, paybox, direct_debit, standing_order, other';

