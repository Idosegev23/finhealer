import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ExpensesForm from '@/components/dashboard/forms/ExpensesForm';
import { DashboardNav } from '@/components/shared/DashboardNav';

export default async function ExpensesPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch existing financial profile with expenses
  const { data: profile } = await (supabase as any)
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <>
      <DashboardNav />
      <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">הוצאות קבועות 🏠</h1>
            <p className="text-lg text-[#555555]">
              מלא את כל ההוצאות החודשיות הקבועות שלך - משכנתא, ביטוחים, תקשורת ועוד
            </p>
          </div>

          <ExpensesForm initialData={profile || {}} />
        </div>
      </div>
    </>
  );
}

