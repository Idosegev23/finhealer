import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - fetch all loans for current user
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
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching loans:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error("Error in GET /api/loans:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - create new loan
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
    if (!body.lender_name || !body.loan_type || !body.original_amount) {
      return NextResponse.json(
        { error: "Missing required fields: lender_name, loan_type, original_amount" },
        { status: 400 }
      );
    }

    const { data, error } = await (supabase as any)
      .from("loans")
      .insert([
        {
          user_id: user.id,
          lender_name: body.lender_name,
          loan_number: body.loan_number,
          loan_type: body.loan_type,
          original_amount: body.original_amount,
          current_balance: body.current_balance || body.original_amount,
          monthly_payment: body.monthly_payment,
          interest_rate: body.interest_rate,
          start_date: body.start_date,
          end_date: body.end_date,
          remaining_payments: body.remaining_payments,
          notes: body.notes,
          active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating loan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/loans:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - update existing loan
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get ID from URL query parameter
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing loan ID" }, { status: 400 });
    }

    const updates = await request.json();

    const { data, error } = await (supabase as any)
      .from("loans")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating loan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error in PATCH /api/loans:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - soft delete loan
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
      return NextResponse.json({ error: "Missing loan ID" }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("loans")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting loan:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/loans:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
