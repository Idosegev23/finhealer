import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TransactionsTable from '@/components/transactions/TransactionsTable';

export default async function TransactionsPage() {
  const supabase = await createClient();

  // בדיקת אימות
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // קבלת נתוני משתמש
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userData) {
    redirect('/login');
  }

  // אם אין מנוי פעיל - הפנה לתשלום
  const userInfo = userData as any
  if (userInfo.subscription_status !== 'active') {
    redirect('/payment');
  }

  // קבלת תנועות - 30 ימים אחרונים
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  // 🆕 שאילתה משופרת - בודקת גם date וגם tx_date
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .or(`date.gte.${thirtyDaysAgoStr},tx_date.gte.${thirtyDaysAgoStr}`)
    .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true') // כולל תנועות parent + מזומן
    .order('created_at', { ascending: false });

  // קבלת קטגוריות למסנן
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('name');

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <header className="bg-[#1E2A3B] border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">תנועות</h1>
          <p className="text-sm text-gray-300">ניהול הכנסות והוצאות</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <TransactionsTable 
          initialTransactions={transactions || []}
          categories={categories || []}
          userId={user.id}
        />
      </div>
    </div>
  );
}

