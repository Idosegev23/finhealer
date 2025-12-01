'use client';

import AdvancedTransactionsTable from '@/components/shared/AdvancedTransactionsTable';

interface Transaction {
  id: string;
  date: string;
  vendor?: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense';
  income_category?: string;
  expense_category?: string;
  payment_method?: string;
}

interface OverviewTransactionsSectionProps {
  transactions: Transaction[];
}

export default function OverviewTransactionsSection({
  transactions,
}: OverviewTransactionsSectionProps) {
  const incomeTransactions = transactions.filter((tx) => tx.type === 'income');
  const expenseTransactions = transactions.filter((tx) => tx.type === 'expense');

  return (
    <div className="space-y-8">
      {/* הכנסות */}
      {incomeTransactions.length > 0 && (
        <AdvancedTransactionsTable
          transactions={incomeTransactions}
          title="💰 הכנסות מתנועות סרוקות"
          type="income"
          showCategory={true}
          showPaymentMethod={false}
        />
      )}

      {/* הוצאות */}
      {expenseTransactions.length > 0 && (
        <AdvancedTransactionsTable
          transactions={expenseTransactions}
          title="💳 הוצאות מתנועות סרוקות"
          type="expense"
          showCategory={true}
          showPaymentMethod={true}
        />
      )}
    </div>
  );
}





