import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - fetch all insurance policies for current user
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
      .from("insurance")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching insurance:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate totals
    const monthlyTotal = data?.reduce((sum: number, ins: any) => sum + Number(ins.monthly_premium || 0), 0) || 0;
    const annualTotal = monthlyTotal * 12;

    // Group by type
    const byType = data?.reduce((acc: Record<string, any[]>, ins: any) => {
      if (!acc[ins.insurance_type]) {
        acc[ins.insurance_type] = [];
      }
      acc[ins.insurance_type].push(ins);
      return acc;
    }, {} as Record<string, any[]>) || {};

    return NextResponse.json({
      data,
      summary: {
        total_policies: data?.length || 0,
        monthly_total: monthlyTotal,
        annual_total: annualTotal,
        by_type: byType,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/insurance:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - create new insurance policy
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
    if (!body.insurance_type || !body.provider || !body.monthly_premium) {
      return NextResponse.json(
        { error: "Missing required fields: insurance_type, provider, monthly_premium" },
        { status: 400 }
      );
    }

    // Insert insurance policy
    const { data, error } = await (supabase as any)
      .from("insurance")
      .insert([
        {
          user_id: user.id,
          insurance_type: body.insurance_type,
          provider: body.provider,
          policy_number: body.policy_number,
          status: body.status || "active",
          coverage_amount: body.coverage_amount,
          monthly_premium: body.monthly_premium,
          start_date: body.start_date,
          end_date: body.end_date,
          notes: body.notes,
          active: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating insurance:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/insurance:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - update existing insurance policy
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
      return NextResponse.json({ error: "Missing insurance ID" }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from("insurance")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating insurance:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("Error in PATCH /api/insurance:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - soft delete insurance policy
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
      return NextResponse.json({ error: "Missing insurance ID" }, { status: 400 });
    }

    // Soft delete - set active to false
    const { error } = await (supabase as any)
      .from("insurance")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting insurance:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/insurance:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

