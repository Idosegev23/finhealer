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

  // Free access — no subscription check needed

  // 30 days back
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Parallel fetches
  const [
    { data: transactions },
    { data: goals },
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('tx_date', thirtyDaysAgoStr)
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
      <TransactionsTable
        initialTransactions={transactions || []}
        categories={categories || []}
        goals={goals || []}
        userId={user.id}
      />
    </PageWrapper>
  );
}
