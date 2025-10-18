import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

    const { data, error } = await (supabase as any)
      .from("income_sources")
      .insert([
        {
          user_id: user.id,
          source_name: body.source_name,
          employment_type: body.employment_type,
          gross_amount: body.gross_amount,
          net_amount: body.net_amount,
          actual_bank_amount: body.actual_bank_amount,
          employer_name: body.employer_name,
          pension_contribution: body.pension_contribution,
          advanced_study_fund: body.advanced_study_fund,
          other_deductions: body.other_deductions,
          is_primary: body.is_primary,
          active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating income:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/income:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

