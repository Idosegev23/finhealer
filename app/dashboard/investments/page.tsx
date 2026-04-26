import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InvestmentsForm from '@/components/dashboard/forms/InvestmentsForm';
import { PageWrapper, PageHeader } from '@/components/ui/design-system';

export default async function InvestmentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await (supabase as any)
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <PageWrapper maxWidth="narrow">
      <PageHeader
        title="תיק השקעות"
        subtitle="מניות, אג״ח, קרנות נאמנות, קריפטו — הכל במקום אחד"
      />
      <InvestmentsForm initialData={profile || {}} />
    </PageWrapper>
  );
}
