import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InvestmentsForm from '@/components/dashboard/forms/InvestmentsForm';

export default async function InvestmentsPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch existing financial profile
  const { data: profile } = await (supabase as any)
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">תיק השקעות 📈</h1>
          <p className="text-lg text-[#555555]">
            ספר לנו על ההשקעות שלך - מניות, אג&quot;ח, קרנות נאמנות, קריפטו ועוד
          </p>
        </div>

        <InvestmentsForm initialData={profile || {}} />
      </div>
    </div>
  );
}

