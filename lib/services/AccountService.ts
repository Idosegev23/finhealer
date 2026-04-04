/**
 * AccountService — manages financial_accounts (bank accounts + credit cards)
 *
 * Idempotent find-or-create pattern: safe to call on every document upload.
 * Handles both bank accounts and credit card accounts.
 */

export interface FinancialAccount {
  id: string;
  user_id: string;
  account_type: 'bank' | 'credit_card';
  institution: string;
  account_number: string | null;
  account_name: string | null;
  card_last4: string | null;
  parent_bank_account_id: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
}

// Common Israeli institution name normalization
const INSTITUTION_ALIASES: Record<string, string> = {
  'לאומי': 'בנק לאומי',
  'leumi': 'בנק לאומי',
  'bank leumi': 'בנק לאומי',
  'הפועלים': 'בנק הפועלים',
  'פועלים': 'בנק הפועלים',
  'hapoalim': 'בנק הפועלים',
  'דיסקונט': 'בנק דיסקונט',
  'discount': 'בנק דיסקונט',
  'מזרחי': 'בנק מזרחי טפחות',
  'מזרחי טפחות': 'בנק מזרחי טפחות',
  'mizrahi': 'בנק מזרחי טפחות',
  'הבינלאומי': 'הבנק הבינלאומי',
  'fibi': 'הבנק הבינלאומי',
  'יהב': 'בנק יהב',
  'אוצר החייל': 'בנק אוצר החייל',
  'מרכנתיל': 'בנק מרכנתיל',
  'max': 'מקס',
  'מקס איט': 'מקס',
  'isracard': 'ישראכרט',
  'ישראכארט': 'ישראכרט',
  'cal': 'כאל',
  'amex': 'אמריקן אקספרס',
  'american express': 'אמריקן אקספרס',
  'diners': 'דיינרס',
  'leumi card': 'לאומי קארד',
};

/**
 * Normalize institution name to a canonical form
 */
export function normalizeInstitution(raw: string): string {
  const lower = raw.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(INSTITUTION_ALIASES)) {
    if (lower === alias || lower.includes(alias)) {
      return canonical;
    }
  }
  return raw.trim();
}

/**
 * Find or create a bank account
 */
export async function findOrCreateBankAccount(
  supabase: any,
  userId: string,
  institution: string,
  accountNumber?: string | null,
  branchNumber?: string | null,
): Promise<FinancialAccount> {
  const normalizedInst = normalizeInstitution(institution);
  const accNum = accountNumber?.trim() || null;

  // Try to find existing
  let query = supabase
    .from('financial_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('account_type', 'bank')
    .eq('institution', normalizedInst);

  if (accNum) {
    query = query.eq('account_number', accNum);
  }

  const { data: existing } = await query.limit(1);

  if (existing && existing.length > 0) {
    // Update metadata if we have new info
    if (branchNumber && !existing[0].metadata?.branch_number) {
      await supabase
        .from('financial_accounts')
        .update({ metadata: { ...existing[0].metadata, branch_number: branchNumber } })
        .eq('id', existing[0].id);
    }
    return existing[0];
  }

  // Create new
  const accountName = accNum
    ? `${normalizedInst} ${accNum}`
    : normalizedInst;

  const { data: created, error } = await supabase
    .from('financial_accounts')
    .insert({
      user_id: userId,
      account_type: 'bank',
      institution: normalizedInst,
      account_number: accNum,
      account_name: accountName,
      metadata: branchNumber ? { branch_number: branchNumber } : {},
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation = race condition, re-fetch
    if (error.code === '23505') {
      const { data: refetch } = await query.limit(1);
      if (refetch && refetch.length > 0) return refetch[0];
    }
    console.error('Failed to create bank account:', error);
    throw error;
  }

  console.log(`🏦 Created bank account: ${accountName} (${created.id})`);
  return created;
}

/**
 * Find or create a credit card account
 */
export async function findOrCreateCreditCardAccount(
  supabase: any,
  userId: string,
  cardCompany: string,
  cardLast4?: string | null,
): Promise<FinancialAccount> {
  const normalizedInst = normalizeInstitution(cardCompany);
  const last4 = cardLast4?.trim() || null;

  // Try to find existing
  let query = supabase
    .from('financial_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('account_type', 'credit_card')
    .eq('institution', normalizedInst);

  if (last4) {
    query = query.eq('card_last4', last4);
  }

  const { data: existing } = await query.limit(1);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // Create new
  const accountName = last4
    ? `${normalizedInst} ****${last4}`
    : normalizedInst;

  const { data: created, error } = await supabase
    .from('financial_accounts')
    .insert({
      user_id: userId,
      account_type: 'credit_card',
      institution: normalizedInst,
      card_last4: last4,
      account_name: accountName,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: refetch } = await query.limit(1);
      if (refetch && refetch.length > 0) return refetch[0];
    }
    console.error('Failed to create credit card account:', error);
    throw error;
  }

  console.log(`💳 Created credit card account: ${accountName} (${created.id})`);
  return created;
}

/**
 * Link a credit card account to its parent bank account
 */
export async function linkCreditCardToBank(
  supabase: any,
  creditCardAccountId: string,
  bankAccountId: string,
): Promise<void> {
  const { error } = await supabase
    .from('financial_accounts')
    .update({ parent_bank_account_id: bankAccountId })
    .eq('id', creditCardAccountId);

  if (error) {
    console.error('Failed to link CC to bank:', error);
    throw new Error(`Failed to link credit card to bank: ${error.message}`);
  }
}

/**
 * Get all financial accounts for a user
 */
export async function getUserAccounts(
  supabase: any,
  userId: string,
): Promise<FinancialAccount[]> {
  const { data, error } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('account_type')
    .order('institution');

  if (error) {
    console.error('Failed to get user accounts:', error);
    throw new Error(`Failed to get user accounts: ${error.message}`);
  }

  return data || [];
}

/**
 * Detect account from AI-extracted document data.
 * Returns the financial_account_id or null.
 */
export async function detectAccountFromDocument(
  supabase: any,
  userId: string,
  documentType: string,
  extractedData: any,
): Promise<string | null> {
  try {
    const reportInfo = extractedData?.report_info || {};
    const accountInfo = extractedData?.account_info || {};
    const billingInfo = extractedData?.billing_info || {};

    if (documentType.includes('credit')) {
      // Credit card statement
      const cardCompany =
        billingInfo.card_company ||
        reportInfo.card_issuer ||
        accountInfo.card_issuer ||
        null;
      const cardLast4 =
        billingInfo.card_last_digits ||
        accountInfo.card_last_digits ||
        null;

      if (!cardCompany && !cardLast4) return null;

      const account = await findOrCreateCreditCardAccount(
        supabase, userId,
        cardCompany || 'כרטיס אשראי',
        cardLast4,
      );
      return account.id;
    }

    if (documentType.includes('bank')) {
      // Bank statement
      const bankName = reportInfo.bank_name || accountInfo.bank_name || null;
      const accountNumber = accountInfo.account_number || null;
      const branchNumber = accountInfo.branch_number || null;

      if (!bankName) return null;

      const account = await findOrCreateBankAccount(
        supabase, userId,
        bankName,
        accountNumber,
        branchNumber,
      );
      return account.id;
    }

    return null;
  } catch (err) {
    console.warn('⚠️ detectAccountFromDocument failed (non-fatal):', err);
    return null;
  }
}
