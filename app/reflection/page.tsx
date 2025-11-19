import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import FullReflectionWizard from '@/components/reflection/FullReflectionWizard';

export default async function ReflectionPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // שליפת נתונים קיימים מהאונבורדינג
  const { data: userData } = await supabase
    .from('users')
    .select('phase, name, age, marital_status, city, email')
    .eq('id', user.id)
    .single();

  // אם כבר עבר את שלב ה-reflection, הפנה ל-dashboard
  const userInfo = userData as any;
  if (userInfo?.phase !== 'reflection') {
    redirect('/dashboard');
  }

  // שליפת פרופיל פיננסי אם קיים
  const { data: profileData } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // שליפת ילדים מהטבלה
  const { data: childrenData } = await supabase
    .from('children')
    .select('*')
    .eq('user_id', user.id);

  // שליפת קטגוריות ברירת מחדל
  const { data: categories } = await supabase
    .from('default_categories')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  // הכנת נתונים מוכנים מראש
  const existingData = {
    name: userInfo?.name || '',
    email: userInfo?.email || '',
    age: userInfo?.age || profileData?.age || null,
    marital_status: userInfo?.marital_status || profileData?.marital_status || '',
    city: userInfo?.city || profileData?.city || '',
    children_count: profileData?.children_count || childrenData?.length || 0,
    children: childrenData || [],
  };

  return (
    <FullReflectionWizard 
      categories={categories || []} 
      userId={user.id}
      existingData={existingData}
    />
  );
}

