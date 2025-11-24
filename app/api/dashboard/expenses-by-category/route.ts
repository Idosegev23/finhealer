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

    // Get transactions and group by category_group from expense_categories table
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        amount,
        category_group,
        type
      `)
      .eq("user_id", user.id)
      .eq("type", "expense")
      .not("category_group", "is", null);

    if (error) {
      console.error("Error fetching transactions:", error);
      return NextResponse.json([]);
    }

    // Group by category_group and sum amounts
    const categoryMap = new Map<string, number>();

    transactions?.forEach((tx) => {
      const group = tx.category_group || "אחר";
      const currentAmount = categoryMap.get(group) || 0;
      categoryMap.set(group, currentAmount + Number(tx.amount));
    });

    // Convert map to array format for the chart
    const result = Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
      }))
      .filter(cat => cat.value > 0)
      .sort((a, b) => b.value - a.value); // Sort by value descending

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in expenses-by-category:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    // Return empty array instead of error
    return NextResponse.json([]);
  }
}

