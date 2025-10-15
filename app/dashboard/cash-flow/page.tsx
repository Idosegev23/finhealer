import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CashFlowForm from '@/components/dashboard/forms/CashFlowForm';

export default async function CashFlowPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch existing financial profile
  const { data: profile } = await (supabase as any)
    .from('user_financial_profile')
    .select('current_account_balance')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">יתרת חשבון עו&quot;ש 💵</h1>
          <p className="text-lg text-[#555555]">
            מה היתרה הנוכחית בחשבון העובר ושב שלך?
          </p>
        </div>

        <CashFlowForm initialBalance={profile?.current_account_balance || 0} />
      </div>
    </div>
  );
}

