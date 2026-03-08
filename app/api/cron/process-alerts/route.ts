import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGreenAPIClient } from '@/lib/greenapi/client';
import { isQuietTime } from '@/lib/utils/quiet-hours';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Cron Job: Process all pending alerts
 * Runs every hour: 0 * * * * (every hour at minute 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quietCheck = isQuietTime();
    if (quietCheck.isQuiet) {
      console.log(`[Cron] Skipped — ${quietCheck.description}`);
      return NextResponse.json({ skipped: true, reason: quietCheck.description });
    }

    console.log('🔔 [CRON] Starting alerts processing...');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let totalAlerts = 0;

    // 1. Check expiring insurance
    totalAlerts += await checkExpiringInsurance(supabase);

    // 2. Check ending loans
    totalAlerts += await checkEndingLoans(supabase);

    // 3. Check recurring missing payments
    totalAlerts += await checkMissingRecurring(supabase);

    // 4. Check reconciliation issues
    totalAlerts += await checkReconciliationIssues(supabase);

    // 5. Check low balance
    totalAlerts += await checkLowBalance(supabase);

    console.log(`✅ [CRON] Processed ${totalAlerts} alerts`);

    return NextResponse.json({
      success: true,
      alertsProcessed: totalAlerts,
    });
  } catch (error: any) {
    console.error('❌ [CRON] Alerts processing failed:', error);
    return NextResponse.json(
      { error: 'Failed to process alerts', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// Alert Checkers
// ============================================================================

/**
 * Check for insurance policies expiring in 30 days
 */
async function checkExpiringInsurance(supabase: any): Promise<number> {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data: expiringInsurance } = await supabase
      .from('insurance')
      .select('*, users(id, name, phone)')
      .eq('active', true)
      .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (!expiringInsurance || expiringInsurance.length === 0) {
      return 0;
    }

    const greenAPI = getGreenAPIClient();
    let count = 0;

    for (const insurance of expiringInsurance) {
      if (!insurance.users?.phone) continue;

      const endDate = new Date(insurance.end_date);
      const daysUntilExpiry = Math.ceil(
        (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      const message = `היי ${insurance.users.name}! ⚠️\n\nביטוח ${insurance.insurance_type} מסתיים בעוד ${daysUntilExpiry} ימים.\nכדאי לחדש! 🛡️`;

      try {
        await greenAPI.sendMessage({
          phoneNumber: insurance.users.phone,
          message,
        });
        count++;
        console.log(`📤 Sent insurance expiry alert to ${insurance.users.phone}`);
      } catch (error) {
        console.error(`Failed to send alert to ${insurance.users.phone}:`, error);
      }
    }

    return count;
  } catch (error) {
    console.error('Error in checkExpiringInsurance:', error);
    return 0;
  }
}

/**
 * Check for loans ending soon (< 3 payments remaining)
 */
async function checkEndingLoans(supabase: any): Promise<number> {
  try {
    const { data: endingLoans } = await supabase
      .from('loans')
      .select('*, users(id, name, phone)')
      .eq('active', true)
      .lte('remaining_payments', 3)
      .gt('remaining_payments', 0);

    if (!endingLoans || endingLoans.length === 0) {
      return 0;
    }

    const greenAPI = getGreenAPIClient();
    let count = 0;

    for (const loan of endingLoans) {
      if (!loan.users?.phone) continue;

      const message = `מזל טוב ${loan.users.name}! 🎉\n\nההלוואה שלך אצל ${loan.lender_name} מסתיימת בעוד ${loan.remaining_payments} חודשים!\nנשאר לשלם: ${loan.current_balance.toFixed(2)} ₪`;

      try {
        await greenAPI.sendMessage({
          phoneNumber: loan.users.phone,
          message,
        });
        count++;
        console.log(`📤 Sent loan ending alert to ${loan.users.phone}`);
      } catch (error) {
        console.error(`Failed to send alert to ${loan.users.phone}:`, error);
      }
    }

    return count;
  } catch (error) {
    console.error('Error in checkEndingLoans:', error);
    return 0;
  }
}

/**
 * Check for missing recurring payments
 */
async function checkMissingRecurring(supabase: any): Promise<number> {
  try {
    // Get overdue patterns using the helper function
    const { data: overduePatterns } = await supabase.rpc('get_overdue_recurring_patterns', {
      user_uuid: null, // Will be replaced per user below
    });

    if (!overduePatterns || overduePatterns.length === 0) {
      // Try direct query for all users
      const { data: patterns } = await supabase
        .from('recurring_patterns')
        .select('*, users(id, name, phone)')
        .eq('status', 'active')
        .lt('next_expected', new Date().toISOString().split('T')[0]);

      if (!patterns || patterns.length === 0) {
        return 0;
      }

      const greenAPI = getGreenAPIClient();
      let count = 0;

      for (const pattern of patterns) {
        if (!pattern.users?.phone) continue;

        const message = `היי ${pattern.users.name}! 🤔\n\nתשלום ${pattern.vendor} (${pattern.expected_amount} ₪) לא הופיע החודש.\nהכל בסדר?`;

        try {
          await greenAPI.sendMessage({
            phoneNumber: pattern.users.phone,
            message,
          });
          count++;
          console.log(`📤 Sent missing recurring alert to ${pattern.users.phone}`);
        } catch (error) {
          console.error(`Failed to send alert to ${pattern.users.phone}:`, error);
        }
      }

      return count;
    }

    return 0;
  } catch (error) {
    console.error('Error in checkMissingRecurring:', error);
    return 0;
  }
}

/**
 * Check for pending reconciliation issues
 */
async function checkReconciliationIssues(supabase: any): Promise<number> {
  try {
    const { data: issues } = await supabase
      .from('reconciliation_issues')
      .select('*, users(id, name, phone)')
      .eq('status', 'pending')
      .eq('severity', 'high'); // Only alert on high severity

    if (!issues || issues.length === 0) {
      return 0;
    }

    const greenAPI = getGreenAPIClient();
    let count = 0;

    for (const issue of issues) {
      if (!issue.users?.phone) continue;

      const message = `היי ${issue.users.name}! ⚠️\n\nמצאנו אי-התאמה:\nסכום צפוי: ${issue.expected_value} ₪\nסכום בפועל: ${issue.actual_value} ₪\nהפרש: ${issue.difference} ₪\n\nצריך לבדוק 👀`;

      try {
        await greenAPI.sendMessage({
          phoneNumber: issue.users.phone,
          message,
        });
        count++;
        console.log(`📤 Sent reconciliation issue alert to ${issue.users.phone}`);
      } catch (error) {
        console.error(`Failed to send alert to ${issue.users.phone}:`, error);
      }
    }

    return count;
  } catch (error) {
    console.error('Error in checkReconciliationIssues:', error);
    return 0;
  }
}

/**
 * Check for low bank balance
 */
async function checkLowBalance(supabase: any): Promise<number> {
  try {
    // Get users with low balance (< 500 ILS)
    const { data: accounts } = await supabase
      .from('bank_accounts')
      .select('*, users(id, name, phone)')
      .eq('is_current', true)
      .lt('current_balance', 500);

    if (!accounts || accounts.length === 0) {
      return 0;
    }

    const greenAPI = getGreenAPIClient();
    let count = 0;

    for (const account of accounts) {
      if (!account.users?.phone) continue;

      const message = `היי ${account.users.name}! 💰\n\nהיתרה בחשבון נמוכה: ${account.current_balance.toFixed(2)} ₪\nכדאי לטעון!`;

      try {
        await greenAPI.sendMessage({
          phoneNumber: account.users.phone,
          message,
        });
        count++;
        console.log(`📤 Sent low balance alert to ${account.users.phone}`);
      } catch (error) {
        console.error(`Failed to send alert to ${account.users.phone}:`, error);
      }
    }

    return count;
  } catch (error) {
    console.error('Error in checkLowBalance:', error);
    return 0;
  }
}

