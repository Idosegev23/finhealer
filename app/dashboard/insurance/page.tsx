import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InsuranceForm from '@/components/dashboard/forms/InsuranceForm';

export default async function InsurancePage() {
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">ביטוחים 🛡️</h1>
          <p className="text-lg text-[#555555]">
            חיבור למסלקה לקבלת מידע מלא על כל הביטוחים שלך
          </p>
        </div>

        <InsuranceForm initialData={profile || {}} />
      </div>
    </div>
  );
}

