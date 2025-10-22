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

    // Get user's financial profile for fixed expenses
    const { data: profile } = await supabase
      .from("user_financial_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const expenses = profile as any || {};

    // Category mapping with Hebrew names
    const categories = [
      { name: "דיור", value: Number(expenses.housing_expenses) || 0 },
      { name: "חשמל/מים/גז", value: Number(expenses.utilities) || 0 },
      { name: "מזון", value: Number(expenses.food_expenses) || 0 },
      { name: "תחבורה", value: Number(expenses.transportation) || 0 },
      { name: "תקשורת", value: Number(expenses.communication) || 0 },
      { name: "ביטוחים", value: Number(expenses.insurance) || 0 },
      { name: "בריאות", value: Number(expenses.health_expenses) || 0 },
      { name: "חינוך", value: Number(expenses.education) || 0 },
      { name: "בילויים", value: Number(expenses.entertainment) || 0 },
      { name: "הלבשה", value: Number(expenses.clothing) || 0 },
      { name: "אחר", value: Number(expenses.other_expenses) || 0 },
    ];

    // Filter out zero values
    const result = categories.filter(cat => cat.value > 0);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in expenses-by-category:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    // Return empty array instead of error
    return NextResponse.json([]);
  }
}

