/**
 * Savings Sync - סנכרון יתרות חיסכון ליעדים
 * רץ יומית כ-Cron Job
 */

import { createServiceClient } from '@/lib/supabase/server';

interface SavingsAccount {
  id: string;
  goal_id: string | null;
  current_balance: number;
  account_name: string;
}

interface Goal {
  id: string;
  name: string;
  current_amount: number;
  target_amount: number;
}

/**
 * סנכרון כל חשבונות החיסכון המקושרים ליעדים
 */
export async function syncSavingsToGoals(): Promise<void> {
  const supabase = createServiceClient();
  
  console.log('[Savings Sync] Starting daily sync...');
  
  try {
    // שלוף כל חשבונות החיסכון עם goal_id
    const { data: savingsAccounts, error: savingsError } = await supabase
      .from('savings_accounts')
      .select('id, goal_id, current_balance, account_name')
      .not('goal_id', 'is', null);
    
    if (savingsError) {
      console.error('[Savings Sync] Failed to fetch savings accounts:', savingsError);
      return;
    }
    
    if (!savingsAccounts || savingsAccounts.length === 0) {
      console.log('[Savings Sync] No savings accounts linked to goals');
      return;
    }
    
    console.log(`[Savings Sync] Found ${savingsAccounts.length} linked accounts`);
    
    // עבור על כל חשבון
    for (const account of savingsAccounts as SavingsAccount[]) {
      await syncSingleAccount(account);
    }
    
    console.log('[Savings Sync] Completed successfully');
    
  } catch (error) {
    console.error('[Savings Sync] Error:', error);
  }
}

/**
 * סנכרון חשבון בודד
 */
async function syncSingleAccount(account: SavingsAccount): Promise<void> {
  if (!account.goal_id) return;
  
  const supabase = createServiceClient();
  
  try {
    // שלוף את היעד
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .select('id, name, current_amount, target_amount')
      .eq('id', account.goal_id)
      .single();
    
    if (goalError || !goal) {
      console.error(`[Savings Sync] Failed to fetch goal ${account.goal_id}:`, goalError);
      return;
    }
    
    const currentGoal = goal as Goal;
    
    // השווה יתרות
    const difference = account.current_balance - currentGoal.current_amount;
    
    if (Math.abs(difference) < 0.01) {
      // אין שינוי משמעותי
      console.log(`[Savings Sync] Goal "${currentGoal.name}" is up to date`);
      return;
    }
    
    // עדכן את היעד
    const { error: updateError } = await supabase
      .from('goals')
      .update({
        current_amount: account.current_balance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.goal_id);
    
    if (updateError) {
      console.error(`[Savings Sync] Failed to update goal ${account.goal_id}:`, updateError);
      return;
    }
    
    console.log(
      `[Savings Sync] Updated goal "${currentGoal.name}": ` +
      `${currentGoal.current_amount.toLocaleString('he-IL')} ₪ → ` +
      `${account.current_balance.toLocaleString('he-IL')} ₪ ` +
      `(${difference > 0 ? '+' : ''}${difference.toLocaleString('he-IL')} ₪)`
    );
    
    // בדוק אם הגענו לאבן דרך חדשה
    const oldProgress = (currentGoal.current_amount / currentGoal.target_amount) * 100;
    const newProgress = (account.current_balance / currentGoal.target_amount) * 100;
    
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (oldProgress < milestone && newProgress >= milestone) {
        console.log(`[Savings Sync] 🎉 Goal "${currentGoal.name}" reached ${milestone}% milestone!`);
        // הטריגר במסד הנתונים יטפל ביצירת ה-milestone
      }
    }
    
  } catch (error) {
    console.error(`[Savings Sync] Error syncing account ${account.id}:`, error);
  }
}

/**
 * סנכרון חשבון בודד לפי ID (לשימוש ידני)
 */
export async function syncSavingsAccountById(accountId: string): Promise<boolean> {
  const supabase = createServiceClient();
  
  const { data: account, error } = await supabase
    .from('savings_accounts')
    .select('id, goal_id, current_balance, account_name')
    .eq('id', accountId)
    .single();
  
  if (error || !account) {
    console.error('[Savings Sync] Failed to fetch account:', error);
    return false;
  }
  
  await syncSingleAccount(account as SavingsAccount);
  return true;
}

/**
 * סנכרון כל חשבונות החיסכון של משתמש
 */
export async function syncUserSavingsAccounts(userId: string): Promise<void> {
  const supabase = createServiceClient();
  
  const { data: accounts, error } = await supabase
    .from('savings_accounts')
    .select('id, goal_id, current_balance, account_name')
    .eq('user_id', userId)
    .not('goal_id', 'is', null);
  
  if (error || !accounts) {
    console.error('[Savings Sync] Failed to fetch user accounts:', error);
    return;
  }
  
  for (const account of accounts as SavingsAccount[]) {
    await syncSingleAccount(account);
  }
}
