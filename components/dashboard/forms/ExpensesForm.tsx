'use client';

import SmartExpensesForm from './SmartExpensesForm';

interface ExpensesFormProps {
  initialData: any;
}

export default function ExpensesForm({ initialData }: ExpensesFormProps) {
  return <SmartExpensesForm initialData={initialData} />;
}
