import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileSpreadsheet, Download } from 'lucide-react'
import Link from 'next/link'
import WhatsAppBanner from '@/components/dashboard/WhatsAppBanner'
import OverviewTransactionsSection from '@/components/reports/OverviewTransactionsSection'

// ✨ רענון הדף כל 30 שניות כדי להציג נתונים עדכניים
export const revalidate = 30;

export default async function OverviewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  const userDataInfo = userData as any

  // קבלת כל הנתונים
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: loans } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  const { data: savings } = await supabase
    .from('savings_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  const { data: insurance } = await supabase
    .from('insurance')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  const { data: pensions } = await supabase
    .from('pension_insurance')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  const { data: income } = await supabase
    .from('income_sources')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)

  // ✨ קבלת הכנסות והוצאות מתנועות החודש (דוחות סרוקים)
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: monthlyTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'confirmed') // רק תנועות מאושרות
    .gte('date', `${currentMonth}-01`)
    .lte('date', `${currentMonth}-31`)
    .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'); // parent transactions + מזומן

  const transactionIncome = (monthlyTransactions || [])
    .filter((tx: any) => tx.type === 'income')
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

  const transactionExpenses = (monthlyTransactions || [])
    .filter((tx: any) => tx.type === 'expense')
    .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

  const profileData: any = profile || {}

  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-8">
        <WhatsAppBanner message="רוצה לעדכן נתונים? לשאול שאלה? כל זה דרך WhatsApp! 💬" />
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-theme-primary mb-2">
              תמונת מצב מלאה 📊
            </h1>
            <p className="text-theme-secondary">
              סיכום מפורט של כל הנתונים הפיננסיים שלך
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" />
            ייצוא לExcel
          </button>
        </div>

        {/* מידע אישי */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-lg mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-theme-primary">מידע אישי</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-theme-tertiary">שם מלא</p>
              <p className="font-bold text-theme-primary">{userDataInfo.name}</p>
            </div>
            <div>
              <p className="text-sm text-theme-tertiary">גיל</p>
              <p className="font-bold text-theme-primary">{profileData.age || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-theme-tertiary">מצב משפחתי</p>
              <p className="font-bold text-theme-primary">{profileData.marital_status || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-theme-tertiary">עיר מגורים</p>
              <p className="font-bold text-theme-primary">{profileData.city || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-theme-tertiary">סטטוס תעסוקה</p>
              <p className="font-bold text-theme-primary">{profileData.employment_status || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-theme-tertiary">מספר ילדים</p>
              <p className="font-bold text-theme-primary">{profileData.dependents || 0}</p>
            </div>
          </div>
        </div>

        {/* סיכום הכנסות והוצאות מתנועות */}
        {(transactionIncome > 0 || transactionExpenses > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-sm text-green-600 dark:text-green-400 font-semibold mb-2">💰 הכנסות החודש (מתנועות)</h3>
              <p className="text-3xl font-black text-green-700 dark:text-green-300">₪{transactionIncome.toLocaleString('he-IL')}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-sm text-red-600 dark:text-red-400 font-semibold mb-2">💳 הוצאות החודש (מתנועות)</h3>
              <p className="text-3xl font-black text-red-700 dark:text-red-300">₪{transactionExpenses.toLocaleString('he-IL')}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-2">📊 מאזן חודשי</h3>
              <p className={`text-3xl font-black ${transactionIncome - transactionExpenses >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {transactionIncome - transactionExpenses >= 0 ? '+' : ''}₪{(transactionIncome - transactionExpenses).toLocaleString('he-IL')}
              </p>
            </div>
          </div>
        )}

        {/* טבלה - הכנסות קבועות */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">💰 מקורות הכנסה קבועים</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">מקור</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">סכום ברוטו</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">סכום נטו</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">תדירות</th>
                </tr>
              </thead>
              <tbody>
                {income && income.length > 0 ? (
                  income.map((item: any, index: number) => (
                    <tr key={index} className="border-b border-theme hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-theme-primary">{item.source_name}</td>
                      <td className="py-3 px-4 text-theme-primary">₪{Number(item.gross_amount || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 font-bold text-green-600 dark:text-green-400">₪{Number(item.net_amount || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{item.frequency || 'חודשי'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-theme-tertiary">אין נתונים</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* טבלה - הלוואות */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">🏦 הלוואות</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">שם הלוואה</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">יתרה נוכחית</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">תשלום חודשי</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">ריבית</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">תאריך סיום</th>
                </tr>
              </thead>
              <tbody>
                {loans && loans.length > 0 ? (
                  loans.map((loan: any, index: number) => (
                    <tr key={index} className="border-b border-theme hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-theme-primary">{loan.loan_name}</td>
                      <td className="py-3 px-4 font-bold text-red-600 dark:text-red-400">₪{Number(loan.current_balance || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 text-theme-primary">₪{Number(loan.monthly_payment || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{loan.interest_rate}%</td>
                      <td className="py-3 px-4 text-theme-tertiary">{loan.end_date || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-theme-tertiary">אין נתונים</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* טבלאות מתנועות - גרסה מתקדמת */}
        {monthlyTransactions && monthlyTransactions.length > 0 && (
          <div className="mb-6">
            <OverviewTransactionsSection transactions={monthlyTransactions} />
          </div>
        )}

        {/* טבלה - חיסכון */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">💵 חיסכון</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">שם חשבון</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">סוג</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">יתרה נוכחית</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">תשואה שנתית</th>
                </tr>
              </thead>
              <tbody>
                {savings && savings.length > 0 ? (
                  savings.map((account: any, index: number) => (
                    <tr key={index} className="border-b border-theme hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-theme-primary">{account.account_name}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{account.account_type}</td>
                      <td className="py-3 px-4 font-bold text-green-600 dark:text-green-400">₪{Number(account.current_balance || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{account.annual_yield || 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-theme-tertiary">אין נתונים</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* טבלה - ביטוחים */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">🛡️ ביטוחים</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">סוג ביטוח</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">חברה</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">מספר פוליסה</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">פרמיה חודשית</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">סכום כיסוי</th>
                </tr>
              </thead>
              <tbody>
                {insurance && insurance.length > 0 ? (
                  insurance.map((policy: any, index: number) => (
                    <tr key={index} className="border-b border-theme hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-theme-primary">{policy.insurance_type}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{policy.company_name}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{policy.policy_number}</td>
                      <td className="py-3 px-4 text-theme-primary">₪{Number(policy.monthly_premium || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 font-bold text-green-600 dark:text-green-400">₪{Number(policy.coverage_amount || 0).toLocaleString('he-IL')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-theme-tertiary">אין נתונים</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* טבלה - פנסיה */}
        <div className="bg-card-dark border border-theme rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-theme-primary mb-4">💼 פנסיה וקופות גמל</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-theme">
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">קרן</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">סוג</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">יתרה</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">תשואה שנתית</th>
                  <th className="text-right py-3 px-4 text-theme-secondary font-semibold">דמי ניהול</th>
                </tr>
              </thead>
              <tbody>
                {pensions && pensions.length > 0 ? (
                  pensions.map((pension: any, index: number) => (
                    <tr key={index} className="border-b border-theme hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-theme-primary">{pension.fund_name}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{pension.fund_type}</td>
                      <td className="py-3 px-4 font-bold text-green-600 dark:text-green-400">₪{Number(pension.current_balance || 0).toLocaleString('he-IL')}</td>
                      <td className="py-3 px-4 text-theme-tertiary">{pension.annual_yield || 0}%</td>
                      <td className="py-3 px-4 text-theme-tertiary">{pension.management_fees || 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-theme-tertiary">אין נתונים</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            ← חזרה לדשבורד
          </Link>
        </div>
      </div>
    </div>
  );
}

