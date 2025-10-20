import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get transactions from last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("amount, transaction_date, type")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("transaction_date", sixMonthsAgo.toISOString())
      .order("transaction_date", { ascending: true });

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by month
    const monthlyData: { [key: string]: number } = {};
    
    (transactions || []).forEach((tx: any) => {
      const date = new Date(tx.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('he-IL', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthName]) {
        monthlyData[monthName] = 0;
      }
      monthlyData[monthName] += Number(tx.amount) || 0;
    });

    // Convert to array format
    const result = Object.entries(monthlyData).map(([month, amount]) => ({
      month,
      amount: Math.round(amount),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in expenses-by-month:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

