import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - fetch all savings accounts for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("savings_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching savings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate totals and progress
    const totalBalance = data?.reduce((sum: number, acc: any) => sum + Number(acc.current_balance || 0), 0) || 0;
    const totalMonthlyDeposit = data?.reduce((sum: number, acc: any) => sum + Number(acc.monthly_deposit || 0), 0) || 0;
    const totalTarget = data?.reduce((sum: number, acc: any) => sum + Number(acc.target_amount || 0), 0) || 0;
    
    // Calculate weighted average return
    const weightedReturn = data?.reduce((sum: number, acc: any) => {
      const balance = Number(acc.current_balance || 0);
      const returnRate = Number(acc.annual_return || 0);
      return sum + (balance * returnRate);
    }, 0) || 0;
    const avgReturn = totalBalance > 0 ? weightedReturn / totalBalance : 0;

    // Group by type
    const byType = data?.reduce((acc: Record<string, any[]>, saving: any) => {
      if (!acc[saving.account_type]) {
        acc[saving.account_type] = [];
      }
      acc[saving.account_type].push(saving);
      return acc;
    }, {} as Record<string, any[]>) || {};

    return NextResponse.json({
      data,
      summary: {
        total_accounts: data?.length || 0,
        total_balance: totalBalance,
        total_monthly_deposit: totalMonthlyDeposit,
        total_target: totalTarget,
        progress_percentage: totalTarget > 0 ? (totalBalance / totalTarget) * 100 : 0,
        average_return: avgReturn,
        by_type: byType,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/savings:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - create new savings account
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.account_name || !body.account_type) {
      return NextResponse.json(
        { error: "Missing required fields: account_name, account_type" },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("savings_accounts")
      .insert([
        {
          user_id: user.id,
          account_name: body.account_name,
          account_type: body.account_type,
          bank_name: body.bank_name,
          current_balance: body.current_balance || 0,
          monthly_deposit: body.monthly_deposit || 0,
          annual_return: body.annual_return,
          target_amount: body.target_amount,
          goal_name: body.goal_name,
          target_date: body.target_date,
          notes: body.notes,
          active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating savings account:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/savings:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - update existing savings account
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing savings account ID" }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from("savings_accounts")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating savings account:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error in PATCH /api/savings:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - soft delete savings account
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing savings account ID" }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("savings_accounts")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting savings account:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/savings:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

