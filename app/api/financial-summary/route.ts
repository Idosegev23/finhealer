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

    // Fetch all financial data in parallel
    const [
      loansRes,
      savingsRes,
      pensionsRes,
      profileRes,
    ] = await Promise.all([
      supabase.from("loans").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("savings_accounts").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("pension_insurance").select("*").eq("user_id", user.id).eq("active", true),
      supabase.from("user_financial_profile").select("*").eq("user_id", user.id).single(),
    ]);

    const loans = loansRes.data || [];
    const savings = savingsRes.data || [];
    const pensions = pensionsRes.data || [];
    const profile: any = profileRes.data || {};

    // Calculate totals
    const loansTotal = loans.reduce((sum: number, loan: any) => sum + (Number(loan.current_balance) || 0), 0);
    const savingsTotal = savings.reduce((sum: number, acc: any) => sum + (Number(acc.current_balance) || 0), 0);
    const pensionTotal = pensions.reduce((sum: number, pen: any) => sum + (Number(pen.current_balance) || 0), 0);
    const investmentsTotal = Number(profile.investments) || 0;
    const currentSavings = Number(profile.current_savings) || 0;

    // Total assets
    const totalAssets = savingsTotal + pensionTotal + investmentsTotal + currentSavings;

    // Total liabilities
    const totalLiabilities = loansTotal + (profile.total_debt || 0);

    // Net worth
    const netWorth = totalAssets - totalLiabilities;

    return NextResponse.json({
      savings_total: savingsTotal,
      pension_total: pensionTotal,
      investments_total: investmentsTotal,
      loans_total: loansTotal,
      debt_total: profile.total_debt || 0,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      net_worth: netWorth,
    });
  } catch (error: any) {
    console.error("Error in GET /api/financial-summary:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

