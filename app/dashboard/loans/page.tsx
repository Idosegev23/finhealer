import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LoansForm from '@/components/dashboard/forms/LoansForm';

export default async function LoansPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Fetch existing loans
  const { data: loans } = await (supabase as any)
    .from('loans')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-[#F5F6F8] py-12 px-4" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#1E2A3B] mb-2">הלוואות והתחייבויות 💳</h1>
          <p className="text-lg text-[#555555]">
            הוסף את כל ההלוואות והחובות שלך - משכנתא, הלוואות, כרטיסי אשראי ועוד
          </p>
          <p className="text-sm text-[#888888] mt-1">
            💡 טיפ: תוכל לסרוק דוח סילוקין למילוי אוטומטי מהיר!
          </p>
        </div>

        <LoansForm initialLoans={loans || []} />
      </div>
    </div>
  );
}

