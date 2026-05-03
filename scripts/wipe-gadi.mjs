/**
 * One-shot: wipe ALL data for gadib1206@gmail.com so he restarts clean.
 * Uses service-role key from .env.local. Run via:
 *   node --env-file=.env.local scripts/wipe-gadi.mjs
 *
 * Order matters — child rows before parent rows so FKs don't block:
 *   1. bank_accounts (FK → uploaded_statements)
 *   2. high-cardinality user-scoped tables
 *   3. uploaded_statements (after its dependents)
 *   4. financial_accounts (after uploaded_statements which had FK to it)
 *   5. public.users (key = 'id', not 'user_id')
 *   6. auth.users
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGET_EMAIL = 'gadib1206@gmail.com';

async function deleteByUser(table, userId) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq('user_id', userId);
  if (error) {
    if (
      error.message.includes('does not exist') ||
      error.message.includes('schema cache') ||
      error.code === 'PGRST205' ||
      error.message.includes('view')
    ) {
      return null; // silently skip missing/view tables
    }
    return `error: ${error.message}`;
  }
  return count ?? 0;
}

async function main() {
  const { data: authUsers, error: lookupErr } = await supabase.auth.admin.listUsers();
  if (lookupErr) throw lookupErr;
  const target = authUsers.users.find((u) => u.email === TARGET_EMAIL);
  if (!target) {
    console.log(`No auth user with email ${TARGET_EMAIL} — nothing to delete.`);
    return;
  }
  const userId = target.id;
  console.log(`Target user: ${TARGET_EMAIL} → ${userId}\n`);

  const stats = {};

  // ── Phase 1: rows that reference uploaded_statements
  {
    const r = await deleteByUser('bank_accounts', userId);
    if (r != null) stats['bank_accounts'] = r;
  }

  // ── Phase 2: high-cardinality user-scoped tables
  for (const t of [
    'wa_messages',
    'pattern_corrections',
    'missing_documents',
    'transactions',
    'savings_accounts',
    'pension_insurance',
    'insurance',
    'loan_consolidation_requests',
    'loans',
    'budget_categories',
    'budgets',
    'goal_milestones',
    'goals',
    'income_sources',
    'children',
    'monthly_summaries',
    'spending_patterns',
    'behavior_insights',
    'subscriptions',
    'pension_report_requests',
    'admin_users',
    'user_category_rules',
    'user_financial_profile',
    'user_income_forecast',
    'receipts',
    // ⬇ uploaded_statements after its dependents
    'uploaded_statements',
    // ⬇ financial_accounts after uploaded_statements (FK to it)
    'financial_accounts',
  ]) {
    const r = await deleteByUser(t, userId);
    if (r != null) stats[t] = r;
  }

  // ── Phase 3: public.users (key = 'id', not 'user_id')
  {
    const { error, count } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .eq('id', userId);
    stats['users'] = error ? `error: ${error.message}` : count ?? 0;
  }

  // ── Phase 4: auth.users
  const { error: authDelErr } = await supabase.auth.admin.deleteUser(userId);
  stats['auth.users'] = authDelErr ? `error: ${authDelErr.message}` : 1;

  console.log('Deletion summary:');
  for (const [t, n] of Object.entries(stats)) {
    if (typeof n === 'number' && n === 0) continue;
    console.log(`  ${t}: ${n}`);
  }
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
