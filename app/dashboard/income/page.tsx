import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SmartIncomeForm from '@/components/income/SmartIncomeForm';
import { DashboardNav } from '@/components/shared/DashboardNav';
import { Sparkles, Zap, TrendingUp } from 'lucide-react';

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
    <>
      <DashboardNav />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4" dir="rtl">
        <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7ED957] to-[#6BC949] text-white rounded-2xl p-8 mb-8 shadow-xl animate-scale-in">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1">הכנסות 💰</h1>
              <p className="text-sm text-green-100">ניהול חכם ומהיר של כל מקורות ההכנסה</p>
            </div>
          </div>
          <p className="text-white/90 leading-relaxed">
            <strong>טופס חכם חדש!</strong> רק 3 שדות במצב מהיר, חישובים אוטומטיים, וסריקת תלוש אופציונלית.
            <span className="inline-flex items-center gap-1 mr-2">
              <Sparkles className="w-4 h-4" />
              <strong>חוסך 80% מהזמן!</strong>
            </span>
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-green-500" />
              <h3 className="font-bold text-gray-900">מצב מהיר</h3>
            </div>
            <p className="text-sm text-gray-600">רק 3 שדות - 30 שניות ומסיימים</p>
          </div>

          <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-gray-900">חישובים חכמים</h3>
            </div>
            <p className="text-sm text-gray-600">המערכת משלימה הכל אוטומטית</p>
          </div>

          <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-gray-900">סריקת תלוש</h3>
            </div>
            <p className="text-sm text-gray-600">צלם תלוש ונמלא הכל בשבילך</p>
          </div>
        </div>

        <SmartIncomeForm initialIncomeSources={incomeSources || []} />
        </div>
      </div>
    </>
  );
}

