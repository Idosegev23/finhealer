import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TransactionsTable from '@/components/transactions/TransactionsTable';
import { PageWrapper, PageHeader } from '@/components/ui/design-system';

export const revalidate = 30;

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id, subscription_status')
    .eq('id', user.id)
    .single();

  if (!userData) {
    redirect('/login');
  }

  // Default window: 30 days. If empty, expand to last 90 days, then to all-time.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let cutoffStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Probe — if no transactions in 30d window, expand
  const { count: recent30 } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('tx_date', cutoffStr)
    .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true');
  if (!recent30 || recent30 === 0) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    cutoffStr = ninetyDaysAgo.toISOString().split('T')[0];
    const { count: recent90 } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('tx_date', cutoffStr)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true');
    if (!recent90 || recent90 === 0) {
      cutoffStr = '1900-01-01'; // all-time fallback
    }
  }

  const [
    { data: transactions },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('tx_date', cutoffStr)
      .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true')
      .order('tx_date', { ascending: false }),
    supabase
      .from('goals')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('name'),
  ]);

  // Extract distinct categories from user's transactions
  const categorySet = new Set<string>();
  (transactions || []).forEach((tx: any) => {
    if (tx.category) categorySet.add(tx.category);
  });
  const categories = Array.from(categorySet)
    .sort()
    .map((name, i) => ({ id: `cat-${i}`, name }));

  return (
    <PageWrapper>
      <PageHeader title="תנועות" subtitle="ניהול הכנסות והוצאות — 30 יום אחרונים" />
      <div data-tour="tx-list">
        <TransactionsTable
          initialTransactions={transactions || []}
          categories={categories || []}
          goals={goals || []}
          userId={user.id}
        />
      </div>
    </PageWrapper>
  );
}
