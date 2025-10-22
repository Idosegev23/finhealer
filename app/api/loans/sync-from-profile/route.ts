import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { inferLoansFromProfile } from "@/lib/utils/inferLoansFromProfile";

/**
 * POST /api/loans/sync-from-profile
 * Syncs loans from user_financial_profile
 * Creates inferred loans if they don't exist
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Get user's financial profile
    const { data: profile, error: profileError } = await supabase
      .from("user_financial_profile")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // 2. Get existing loans
    const { data: existingLoans } = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true);

    // 3. Infer loans from profile
    const inferredLoans = inferLoansFromProfile({
      rent_mortgage: (profile as any).rent_mortgage,
      bank_loans: (profile as any).bank_loans,
      other_debts: (profile as any).other_debts,
      leasing: (profile as any).leasing,
    });

    // 4. Check which inferred loans don't exist yet
    const loansToCreate = inferredLoans.filter((inferred) => {
      // Check if we already have a loan of this type (inferred or manual)
      const exists = existingLoans?.some(
        (existing: any) => existing.loan_type === inferred.loan_type
      );
      return !exists && inferred.monthly_payment > 0;
    });

    if (loansToCreate.length === 0) {
      return NextResponse.json({
        message: "No new loans to create",
        synced: 0,
      });
    }

    // 5. Create the inferred loans
    const { data: createdLoans, error: createError } = await (supabase as any)
      .from("loans")
      .insert(
        loansToCreate.map((loan) => ({
          user_id: user.id,
          lender_name: loan.lender_name,
          loan_type: loan.loan_type,
          monthly_payment: loan.monthly_payment,
          current_balance: loan.current_balance,
          original_amount: loan.current_balance, // Same as current for inferred
          interest_rate: loan.interest_rate,
          remaining_payments: loan.remaining_payments,
          notes: loan.notes,
          active: true,
        }))
      )
      .select();

    if (createError) {
      console.error("Error creating inferred loans:", createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully synced ${loansToCreate.length} loans from profile`,
      synced: loansToCreate.length,
      loans: createdLoans,
    });
  } catch (error: any) {
    console.error("Error in POST /api/loans/sync-from-profile:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

