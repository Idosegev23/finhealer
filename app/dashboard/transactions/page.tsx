import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TransactionsTable from '@/components/transactions/TransactionsTable';

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

  const userInfo = userData as any;
  if (userInfo.subscription_status !== 'active') {
    redirect('/payment');
  }

  // 30 days back
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // Parallel fetches
  const [
    { data: transactions },
    { data: categories },
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
      .from('budget_categories')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('name'),
    supabase
      .from('goals')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('name'),
  ]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">תנועות</h1>
          <p className="text-sm text-gray-500">ניהול הכנסות והוצאות</p>
        </div>

        <TransactionsTable
          initialTransactions={transactions || []}
          categories={categories || []}
          goals={goals || []}
          userId={user.id}
        />
      </div>
    </div>
  );
}
