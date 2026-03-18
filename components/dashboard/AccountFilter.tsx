'use client';

import { useEffect, useState } from 'react';
import { Building2, CreditCard } from 'lucide-react';

interface FinancialAccount {
  id: string;
  account_type: 'bank' | 'credit_card';
  institution: string;
  account_name: string | null;
  card_last4: string | null;
  transaction_count: number;
}

interface AccountFilterProps {
  value: string | null; // null = all accounts
  onChange: (accountId: string | null) => void;
}

export function AccountFilter({ value, onChange }: AccountFilterProps) {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Don't render if user has 0 or 1 accounts
  if (loading || accounts.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        onClick={() => onChange(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
          value === null
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
        }`}
      >
        כל החשבונות
      </button>
      {accounts.map(acc => (
        <button
          key={acc.id}
          onClick={() => onChange(acc.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            value === acc.id
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
          }`}
        >
          {acc.account_type === 'bank' ? (
            <Building2 className="w-3.5 h-3.5" />
          ) : (
            <CreditCard className="w-3.5 h-3.5" />
          )}
          {acc.account_name || acc.institution}
          {acc.transaction_count > 0 && (
            <span className="text-[10px] opacity-60">({acc.transaction_count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
