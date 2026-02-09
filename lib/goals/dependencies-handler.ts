/**
 * מטפל בתלויות בין יעדים
 */

import type { Goal } from '@/types/goals';

/**
 * מיון טופולוגי של יעדים לפי תלויות
 * יעדים ללא תלויות קודם, אחריהם יעדים תלויים
 */
export function sortGoalsByDependencies(goals: Goal[]): Goal[] {
  const sorted: Goal[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const goalsMap = new Map(goals.map(g => [g.id, g]));

  function visit(goalId: string) {
    if (visited.has(goalId)) return;
    if (visiting.has(goalId)) {
      // תלות מעגלית - נתעלם מהתלות
      console.warn(`Circular dependency detected for goal ${goalId}`);
      return;
    }

    visiting.add(goalId);
    const goal = goalsMap.get(goalId);
    
    if (goal?.depends_on_goal_id) {
      visit(goal.depends_on_goal_id);
    }

    visiting.delete(goalId);
    visited.add(goalId);
    
    if (goal) {
      sorted.push(goal);
    }
  }

  for (const goal of goals) {
    if (!visited.has(goal.id)) {
      visit(goal.id);
    }
  }

  return sorted;
}

/**
 * בדיקה אם יעד יכול להתחיל (תלות הושלמה)
 */
export function canGoalStart(goal: Goal, allGoals: Goal[]): boolean {
  if (!goal.depends_on_goal_id) return true;

  const dependency = allGoals.find(g => g.id === goal.depends_on_goal_id);
  
  if (!dependency) {
    // תלות לא קיימת - נתעלם
    console.warn(`Dependency goal ${goal.depends_on_goal_id} not found for goal ${goal.id}`);
    return true;
  }

  // בדוק אם התלות הושלמה
  return dependency.status === 'completed';
}

/**
 * חישוב מקדם הקטנה להקצאה בגלל תלות
 * - 1.0 = אין תלות או שהתלות הושלמה
 * - 0.3 = יעד תלוי שעדיין לא התחיל (תלות לא הושלמה)
 * - 0.6 = יעד תלוי שהתלות בדרך (הושג > 50%)
 */
export function getDependencyReductionFactor(
  goal: Goal,
  allGoals: Goal[],
  defaultReduction = 0.3
): number {
  if (!goal.depends_on_goal_id) return 1.0;

  const dependency = allGoals.find(g => g.id === goal.depends_on_goal_id);
  
  if (!dependency) return 1.0;

  // תלות הושלמה - אין הקטנה
  if (dependency.status === 'completed') {
    return 1.0;
  }

  // חשב אחוז השלמה של התלות
  const dependencyProgress = dependency.target_amount > 0
    ? dependency.current_amount / dependency.target_amount
    : 0;

  // אם התלות עברה 50% - תן הקצאה חלקית גבוהה יותר
  if (dependencyProgress >= 0.5) {
    return 0.6; // 60% מההקצאה
  }

  // אחרת - הקצאה מופחתת
  return defaultReduction;
}

/**
 * בדיקת תלויות מעגליות
 */
export function detectCircularDependencies(goals: Goal[]): string[] {
  const warnings: string[] = [];
  const goalsMap = new Map(goals.map(g => [g.id, g]));

  function hasCircularDep(goalId: string, visited = new Set<string>()): boolean {
    if (visited.has(goalId)) return true;

    const goal = goalsMap.get(goalId);
    if (!goal?.depends_on_goal_id) return false;

    visited.add(goalId);
    return hasCircularDep(goal.depends_on_goal_id, visited);
  }

  for (const goal of goals) {
    if (goal.depends_on_goal_id && hasCircularDep(goal.id)) {
      warnings.push(`⚠️ תלות מעגלית זוהתה ביעד "${goal.name}"`);
    }
  }

  return warnings;
}

/**
 * קבלת שרשרת תלויות של יעד
 */
export function getDependencyChain(goal: Goal, allGoals: Goal[]): Goal[] {
  const chain: Goal[] = [goal];
  const visited = new Set<string>([goal.id]);
  let current = goal;

  while (current.depends_on_goal_id && !visited.has(current.depends_on_goal_id)) {
    const dependency = allGoals.find(g => g.id === current.depends_on_goal_id);
    if (!dependency) break;

    chain.push(dependency);
    visited.add(dependency.id);
    current = dependency;
  }

  return chain.reverse(); // מהתלות הראשונה ליעד עצמו
}

/**
 * המלצות לפי תלויות
 */
import type { Suggestion, SuggestionType } from '@/types/goals';

export function generateDependencySuggestions(
  goals: Goal[],
  warnings: string[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // זיהוי יעדים חסומים על ידי תלויות
  const blockedGoals = goals.filter(g => 
    g.depends_on_goal_id && 
    !canGoalStart(g, goals) &&
    g.status === 'active'
  );

  for (const blocked of blockedGoals) {
    const dependency = goals.find(g => g.id === blocked.depends_on_goal_id);
    if (dependency) {
      const progress = dependency.target_amount > 0
        ? Math.round((dependency.current_amount / dependency.target_amount) * 100)
        : 0;

      const priority: 'high' | 'medium' = progress < 25 ? 'high' : 'medium';
      suggestions.push({
        type: 'change_priority' as const,
        message: `יעד "${blocked.name}" מחכה להשלמת "${dependency.name}" (${progress}% הושלם)`,
        impact: `תעדוף "${dependency.name}" יזרז את התקדמות "${blocked.name}"`,
        priority,
      });
    }
  }

  // תלויות מעגליות
  if (warnings.some(w => w.includes('תלות מעגלית'))) {
    suggestions.push({
      type: 'remove_goal' as const,
      message: 'זוהו תלויות מעגליות - שקול לשנות את סדר התלויות',
      impact: 'מניעת חסימות בין יעדים',
      priority: 'high' as const,
    });
  }

  return suggestions;
}
