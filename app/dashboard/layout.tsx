import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/shared/DashboardNav';
import { DashboardWrapper } from '@/components/dashboard/DashboardWrapper';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // בדיקת אימות
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardWrapper>
      <DashboardNav />
      {children}
    </DashboardWrapper>
  );
}

