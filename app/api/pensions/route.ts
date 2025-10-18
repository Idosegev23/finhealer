import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - fetch all pension/provident funds for current user
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
      .from("pension_insurance")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pensions:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate totals
    const totalBalance = data?.reduce((sum: number, pen: any) => sum + Number(pen.current_balance || 0), 0) || 0;
    const totalMonthlyDeposit = data?.reduce((sum: number, pen: any) => sum + Number(pen.monthly_deposit || 0), 0) || 0;
    const totalEmployerContribution = data?.reduce((sum: number, pen: any) => sum + Number(pen.employer_contribution || 0), 0) || 0;
    const totalEmployeeContribution = data?.reduce((sum: number, pen: any) => sum + Number(pen.employee_contribution || 0), 0) || 0;

    // Calculate weighted average fees and returns
    const weightedManagementFee = data?.reduce((sum: number, pen: any) => {
      const balance = Number(pen.current_balance || 0);
      const fee = Number(pen.management_fee_percentage || 0);
      return sum + (balance * fee);
    }, 0) || 0;
    const avgManagementFee = totalBalance > 0 ? weightedManagementFee / totalBalance : 0;

    const weightedReturn = data?.reduce((sum: number, pen: any) => {
      const balance = Number(pen.current_balance || 0);
      const returnRate = Number(pen.annual_return || 0);
      return sum + (balance * returnRate);
    }, 0) || 0;
    const avgReturn = totalBalance > 0 ? weightedReturn / totalBalance : 0;

    // Group by fund type
    const byType = data?.reduce((acc: Record<string, any[]>, pen: any) => {
      if (!acc[pen.fund_type]) {
        acc[pen.fund_type] = [];
      }
      acc[pen.fund_type].push(pen);
      return acc;
    }, {} as Record<string, any[]>) || {};

    // Group by provider
    const byProvider = data?.reduce((acc: Record<string, any[]>, pen: any) => {
      if (!acc[pen.provider]) {
        acc[pen.provider] = [];
      }
      acc[pen.provider].push(pen);
      return acc;
    }, {} as Record<string, any[]>) || {};

    return NextResponse.json({
      data,
      summary: {
        total_funds: data?.length || 0,
        total_balance: totalBalance,
        total_monthly_deposit: totalMonthlyDeposit,
        total_employer_contribution: totalEmployerContribution,
        total_employee_contribution: totalEmployeeContribution,
        average_management_fee: avgManagementFee,
        average_return: avgReturn,
        by_type: byType,
        by_provider: byProvider,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/pensions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - create new pension/provident fund
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
    if (!body.fund_name || !body.fund_type || !body.provider) {
      return NextResponse.json(
        { error: "Missing required fields: fund_name, fund_type, provider" },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("pension_insurance")
      .insert([
        {
          user_id: user.id,
          fund_name: body.fund_name,
          fund_type: body.fund_type,
          provider: body.provider,
          policy_number: body.policy_number,
          employee_type: body.employee_type,
          current_balance: body.current_balance || 0,
          monthly_deposit: body.monthly_deposit || 0,
          employer_contribution: body.employer_contribution || 0,
          employee_contribution: body.employee_contribution || 0,
          management_fee_percentage: body.management_fee_percentage,
          deposit_fee_percentage: body.deposit_fee_percentage,
          annual_return: body.annual_return,
          start_date: body.start_date,
          seniority_date: body.seniority_date,
          notes: body.notes,
          active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating pension fund:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/pensions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - update existing pension/provident fund
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
      return NextResponse.json({ error: "Missing pension fund ID" }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from("pension_insurance")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating pension fund:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error in PATCH /api/pensions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - soft delete pension/provident fund
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
      return NextResponse.json({ error: "Missing pension fund ID" }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("pension_insurance")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting pension fund:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/pensions:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

