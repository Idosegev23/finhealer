import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SmartIncomeForm from '@/components/income/SmartIncomeForm';
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
    <div className="min-h-screen bg-dashboard py-12 px-4" dir="rtl">
        <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-card-dark border border-theme rounded-2xl p-8 mb-8 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-1 text-theme-primary">הכנסות 💰</h1>
              <p className="text-sm text-theme-secondary">ניהול חכם ומהיר של כל מקורות ההכנסה</p>
            </div>
          </div>
          <p className="text-theme-secondary leading-relaxed">
            <strong className="text-theme-primary">טופס חכם חדש!</strong> רק 3 שדות במצב מהיר, חישובים אוטומטיים, וסריקת תלוש אופציונלית.
            <span className="inline-flex items-center gap-1 mr-2 text-green-600 dark:text-green-400">
              <Sparkles className="w-4 h-4" />
              <strong>חוסך 80% מהזמן!</strong>
            </span>
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card-dark border border-theme rounded-lg p-4 border-r-4 border-r-green-500">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-green-500" />
              <h3 className="font-bold text-theme-primary">מצב מהיר</h3>
            </div>
            <p className="text-sm text-theme-secondary">רק 3 שדות - 30 שניות ומסיימים</p>
          </div>

          <div className="bg-card-dark border border-theme rounded-lg p-4 border-r-4 border-r-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h3 className="font-bold text-theme-primary">חישובים חכמים</h3>
            </div>
            <p className="text-sm text-theme-secondary">המערכת משלימה הכל אוטומטית</p>
          </div>

          <div className="bg-card-dark border border-theme rounded-lg p-4 border-r-4 border-r-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h3 className="font-bold text-theme-primary">סריקת תלוש</h3>
            </div>
            <p className="text-sm text-theme-secondary">צלם תלוש ונמלא הכל בשבילך</p>
          </div>
        </div>

        <SmartIncomeForm initialIncomeSources={incomeSources || []} />
        </div>
      </div>
  );
}

