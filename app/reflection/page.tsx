import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FullReflectionWizard from '@/components/reflection/FullReflectionWizard';

export default async function ReflectionPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // בדיקת phase - רק reflection יכול להיכנס
  const { data: userData } = await supabase
    .from('users')
    .select('phase, name')
    .eq('id', user.id)
    .single();

  // אם כבר עבר את שלב ה-reflection, הפנה ל-dashboard
  if (userData?.phase !== 'reflection') {
    redirect('/dashboard');
  }

  // שליפת קטגוריות ברירת מחדל
  const { data: categories } = await supabase
    .from('default_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  return <FullReflectionWizard categories={categories || []} userId={user.id} />;
}

