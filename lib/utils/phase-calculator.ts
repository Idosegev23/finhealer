import { createClient } from '@/lib/supabase/server';

export type Phase = 'data_collection' | 'behavior' | 'budget' | 'goals' | 'monitoring';

/**
 * Calculate the appropriate phase for a user based on their data SPAN
 * This is based on how much historical data they have, not how long they've been using the app
 * 
 * Example: If a user uploads 6 months of bank statements on day 1, they immediately have
 * 180 days of data and can skip directly to 'monitoring' phase!
 * 
 * @param userId - The user's ID
 * @returns The calculated phase
 */
export async function calculateUserPhase(userId: string): Promise<Phase> {
  const daysOfData = await getDaysOfData(userId);
  
  // Phase 1: Data Collection - need at least 30 days of historical data
  if (daysOfData < 30) return 'data_collection';
  
  // Phase 2: Behavior Analysis - 30-60 days of data
  if (daysOfData < 60) return 'behavior';
  
  // Phase 3: Smart Budget - 60-90 days of data
  if (daysOfData < 90) return 'budget';
  
  // Phase 4: Goals Setting - 90-120 days of data
  if (daysOfData < 120) return 'goals';
  
  // Phase 5: Monitoring - 120+ days of data (4+ months)
  return 'monitoring';
}

/**
 * Get the number of days covered by transaction data (data span)
 * This looks at the range of dates in the data, not how long the user has been registered
 * @param userId - The user's ID
 * @returns Number of days covered by data
 */
export async function getDaysOfData(userId: string): Promise<number> {
  const supabase = await createClient();
  
  // Get all confirmed transactions for the user
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('date')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('date', { ascending: false });

  if (error || !transactions || transactions.length === 0) {
    return 0;
  }

  // Count unique dates
  const uniqueDates = new Set(transactions.map(t => t.date));
  
  // Calculate days between oldest and newest transaction
  // This represents the TIME SPAN of the data, not how long they've been using the app
  const dates = Array.from(uniqueDates).sort();
  const oldestDate = new Date(dates[0]);
  const newestDate = new Date(dates[dates.length - 1]);
  
  const diffTime = Math.abs(newestDate.getTime() - oldestDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Add 1 to include both start and end dates
  return diffDays + 1;
}

/**
 * Get days remaining until next phase
 * @param userId - The user's ID
 * @returns Days remaining
 */
export async function getDaysUntilNextPhase(userId: string): Promise<number> {
  const daysOfData = await getDaysOfData(userId);
  
  if (daysOfData < 30) return 30 - daysOfData;
  if (daysOfData < 60) return 60 - daysOfData;
  if (daysOfData < 90) return 90 - daysOfData;
  if (daysOfData < 120) return 120 - daysOfData;
  return 0; // Already at monitoring
}

/**
 * Get phase name in Hebrew
 * @param phase - The phase
 * @returns Hebrew name
 */
export function getPhaseName(phase: Phase): string {
  const names: Record<Phase, string> = {
    data_collection: 'איסוף נתונים',
    behavior: 'ניתוח הרגלים',
    budget: 'תקציב חכם',
    goals: 'הגדרת יעדים',
    monitoring: 'מעקב רציף',
  };
  
  return names[phase];
}

/**
 * Get phase number (1-5)
 * @param phase - The phase
 * @returns Phase number
 */
export function getPhaseNumber(phase: Phase): number {
  const numbers: Record<Phase, number> = {
    data_collection: 1,
    behavior: 2,
    budget: 3,
    goals: 4,
    monitoring: 5,
  };
  
  return numbers[phase];
}

/**
 * Check if user should be upgraded to next phase
 * @param userId - The user's ID
 * @returns True if should upgrade
 */
export async function shouldUpgradePhase(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Get current phase
  const { data: userData } = await supabase
    .from('users')
    .select('phase')
    .eq('id', userId)
    .single();
  
  if (!userData) return false;
  
  const currentPhase = userData.phase as Phase;
  const calculatedPhase = await calculateUserPhase(userId);
  
  // Should upgrade if calculated phase is more advanced
  return getPhaseNumber(calculatedPhase) > getPhaseNumber(currentPhase);
}

