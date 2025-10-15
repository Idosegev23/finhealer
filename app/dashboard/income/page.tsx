import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import IncomeForm from '@/components/dashboard/forms/IncomeForm';

export default async function IncomePage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch existing income sources
  const { data: incomeSources } = await (supabase as any)
    .from('income_sources')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">הכנסות 💰</h1>
          <p className="text-lg text-[#555555]">
            הוסף את כל מקורות ההכנסה שלך - משכורת, עבודות נוספות, השקעות ועוד
          </p>
        </div>

        <IncomeForm initialIncomeSources={incomeSources || []} />
      </div>
    </div>
  );
}

