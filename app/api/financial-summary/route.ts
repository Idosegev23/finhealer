import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - calculate complete financial summary
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current month for transactions
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Fetch all financial data in parallel
    const [
      loansRes,
      savingsRes,
      pensionsRes,
      profileRes,
      incomeSourcesRes,
      monthlyTransactionsRes,
      bankAccountsRes,
    ] = await Promise.all([
      supabase.from("loans").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("savings_accounts").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("pension_insurance").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("user_financial_profile").select("*").eq("user_id", user.id).single(),
      supabase.from("income_sources").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("transactions").select("*").eq("user_id", user.id)
        .eq('status', 'confirmed') // ⭐ רק תנועות מאושרות - לא ממתינות!
        .gte('tx_date', `${currentMonth}-01`)
        .lte('tx_date', `${currentMonth}-31`)
        .or('has_details.is.null,has_details.eq.false,is_cash_expense.eq.true'), // כולל תנועות parent + מזומן
      supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_current", true).single(),
    ]);

    const loans = loansRes.data || [];
    const savings = savingsRes.data || [];
    const pensions = pensionsRes.data || [];
    const profile: any = profileRes.data || {};
    const incomeSources = incomeSourcesRes.data || [];
    const monthlyTransactions = monthlyTransactionsRes.data || [];
    const currentBankAccount: any = bankAccountsRes.data || null;

    // Calculate income and expenses from actual transactions
    const monthlyIncomeFromTransactions = monthlyTransactions
      .filter((tx: any) => tx.type === 'income')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);
    
    const monthlyExpensesFromTransactions = monthlyTransactions
      .filter((tx: any) => tx.type === 'expense')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0);

    // Calculate totals
    const loansTotal = loans.reduce((sum: number, loan: any) => sum + (Number(loan.current_balance) || 0), 0);
    const savingsTotal = savings.reduce((sum: number, acc: any) => sum + (Number(acc.current_balance) || 0), 0);
    const pensionTotal = pensions.reduce((sum: number, pen: any) => sum + (Number(pen.current_balance) || 0), 0);
    const investmentsTotal = Number(profile.investments) || 0;
    const currentSavings = Number(profile.current_savings) || 0;
    
    // ✅ Get current account balance from bank_accounts (from uploaded statements), fallback to manual profile entry
    const currentAccountBalance = currentBankAccount 
      ? Number(currentBankAccount.current_balance) || 0
      : Number(profile.current_account_balance) || 0;

    // Total assets (כל מה שיש לך)
    const totalAssets = 
      currentAccountBalance +  // יתרת עו"ש
      savingsTotal +           // חיסכונות
      pensionTotal +           // פנסיה וקופות גמל
      investmentsTotal +       // השקעות
      currentSavings;          // חיסכון נוכחי

    // Total liabilities (כל מה שאתה חייב)
    const totalLiabilities = loansTotal;

    // Net worth (שווי נטו = נכסים - התחייבויות)
    const netWorth = totalAssets - totalLiabilities;

    // Calculate monthly income - prefer actual transactions over manual entries
    const incomeFromSources = incomeSources.reduce((sum: number, source: any) => {
      return sum + (Number(source.net_amount) || Number(source.actual_bank_amount) || 0);
    }, 0);

    // Priority: 1. Transactions 2. Income sources 3. Profile
    const monthlyIncome = monthlyIncomeFromTransactions > 0 
      ? monthlyIncomeFromTransactions 
      : (incomeFromSources || Number(profile.total_monthly_income) || Number(profile.monthly_income) || 0);

    // Monthly expenses from transactions (fallback to profile)
    const monthlyExpenses = monthlyExpensesFromTransactions > 0
      ? monthlyExpensesFromTransactions
      : (Number(profile.total_monthly_expenses) || 0);

    return NextResponse.json({
      current_account_balance: currentAccountBalance,
      monthly_income: monthlyIncome,
      monthly_expenses: monthlyExpenses, // הוספנו שדה הוצאות
      total_debt: totalLiabilities,
      net_worth: netWorth,
      savings_total: savingsTotal,
      pension_total: pensionTotal,
      investments_total: investmentsTotal,
      loans_total: loansTotal,
      debt_total: profile.total_debt || 0,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
    });
  } catch (error: any) {
    console.error("Error in GET /api/financial-summary:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

