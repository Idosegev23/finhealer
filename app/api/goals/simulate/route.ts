/**
 * API Route: /api/goals/simulate
 * 
 * מריץ סימולציות "מה יקרה אם..." על יעדים
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateOptimalAllocations } from '@/lib/goals/goals-balancer';
import type { SimulationScenario, SimulationResult, Goal, GoalAllocationInput } from '@/types/goals';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, scenario } = body as { userId: string; scenario: SimulationScenario };
    
    if (!userId || !scenario) {
      return NextResponse.json(
        { error: 'Missing userId or scenario' },
        { status: 400 }
      );
    }
    
    // בדוק הרשאות
    const supabase = createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // שלוף מצב נוכחי
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    if (goalsError) throw goalsError;
    
    const { data: profile } = await supabase
      .from('user_financial_profile')
      .select('total_monthly_income, total_fixed_expenses')
      .eq('user_id', userId)
      .single();
    
    const currentIncome = profile?.total_monthly_income || 0;
    const currentExpenses = profile?.total_fixed_expenses || 0;
    
    // חשב מצב "לפני"
    const beforeInput: GoalAllocationInput = {
      userId,
      goals: goals as Goal[],
      monthlyIncome: currentIncome,
      fixedExpenses: currentExpenses,
    };
    
    const before = await calculateOptimalAllocations(beforeInput);
    
    // החל תרחיש
    const afterInput = applyScenario(beforeInput, scenario, goals as Goal[]);
    const after = await calculateOptimalAllocations(afterInput);
    
    // חשב השפעה
    const impactSummary = calculateImpact(before, after);
    
    const result: SimulationResult = {
      scenario,
      before,
      after,
      impact_summary: impactSummary,
    };
    
    return NextResponse.json({
      success: true,
      result,
    });
    
  } catch (error: any) {
    console.error('Error in /api/goals/simulate:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * החלת תרחיש על הקלט
 */
function applyScenario(
  input: GoalAllocationInput,
  scenario: SimulationScenario,
  goals: Goal[]
): GoalAllocationInput {
  const newInput = { ...input };
  let newGoals = [...goals];
  
  switch (scenario.type) {
    case 'income_change':
      if (scenario.income_change !== undefined) {
        newInput.monthlyIncome = (newInput.monthlyIncome || 0) + scenario.income_change;
      }
      break;
      
    case 'expense_change':
      if (scenario.expense_change !== undefined) {
        newInput.fixedExpenses = (newInput.fixedExpenses || 0) + scenario.expense_change;
      }
      break;
      
    case 'new_goal':
      if (scenario.new_goal) {
        const tempGoal: Goal = {
          id: 'temp-' + Date.now(),
          user_id: input.userId,
          name: scenario.new_goal.name || 'יעד חדש',
          target_amount: scenario.new_goal.target_amount || 10000,
          current_amount: scenario.new_goal.current_amount || 0,
          priority: scenario.new_goal.priority || 5,
          status: 'active',
          is_flexible: scenario.new_goal.is_flexible ?? true,
          min_allocation: scenario.new_goal.min_allocation || 0,
          monthly_allocation: 0,
          auto_adjust: scenario.new_goal.auto_adjust ?? true,
          created_at: new Date(),
          updated_at: new Date(),
          start_date: scenario.new_goal.start_date,
          deadline: scenario.new_goal.deadline,
        };
        newGoals.push(tempGoal);
      }
      break;
      
    case 'remove_goal':
      if (scenario.remove_goal_id) {
        newGoals = newGoals.filter(g => g.id !== scenario.remove_goal_id);
      }
      break;
      
    case 'priority_change':
      if (scenario.priority_changes) {
        for (const change of scenario.priority_changes) {
          const goal = newGoals.find(g => g.id === change.goal_id);
          if (goal) {
            goal.priority = change.new_priority;
          }
        }
      }
      break;
  }
  
  newInput.goals = newGoals;
  return newInput;
}

/**
 * חישוב השפעת התרחיש
 */
function calculateImpact(before: any, after: any) {
  let goals_improved = 0;
  let goals_worsened = 0;
  let total_time_saved_months = 0;
  
  // השווה הקצאות
  for (const afterAlloc of after.allocations) {
    const beforeAlloc = before.allocations.find(
      (a: any) => a.goal_id === afterAlloc.goal_id
    );
    
    if (!beforeAlloc) continue;
    
    // בדוק שיפור
    if (afterAlloc.monthly_allocation > beforeAlloc.monthly_allocation) {
      goals_improved++;
      const timeSaved = beforeAlloc.months_to_complete - afterAlloc.months_to_complete;
      if (timeSaved > 0) {
        total_time_saved_months += timeSaved;
      }
    } else if (afterAlloc.monthly_allocation < beforeAlloc.monthly_allocation) {
      goals_worsened++;
    }
  }
  
  // המלצה
  let recommendation = '';
  if (goals_improved > goals_worsened) {
    recommendation = `✅ תרחיש חיובי! ${goals_improved} יעדים ישתפרו`;
  } else if (goals_improved < goals_worsened) {
    recommendation = `⚠️ תרחיש שלילי - ${goals_worsened} יעדים יוקטנו`;
  } else {
    recommendation = 'ללא שינוי משמעותי ביעדים';
  }
  
  if (total_time_saved_months > 0) {
    recommendation += ` 🎉 תחסוך ${total_time_saved_months} חודשים!`;
  }
  
  return {
    goals_improved,
    goals_worsened,
    total_time_saved_months,
    recommendation,
  };
}

