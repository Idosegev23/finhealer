import { describe, it, expect } from 'vitest';
import { calculateUrgencyScore, suggestPriorityAdjustments } from '@/lib/goals/goals-balancer';
import type { Goal } from '@/types/goals';

// ============================================================================
// Test helpers
// ============================================================================

function makeGoal(overrides: Partial<Goal> & { id: string; name: string }): Goal {
  return {
    user_id: 'user-1',
    target_amount: 10000,
    current_amount: 0,
    priority: 5,
    status: 'active',
    is_flexible: true,
    min_allocation: 0,
    monthly_allocation: 0,
    auto_adjust: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ============================================================================
// calculateUrgencyScore
// ============================================================================

describe('calculateUrgencyScore', () => {
  it('returns goal_id matching input', () => {
    const goal = makeGoal({ id: 'g-test', name: 'חיסכון' });
    const result = calculateUrgencyScore(goal);
    expect(result.goal_id).toBe('g-test');
  });

  it('urgency_score is between 0 and 1', () => {
    const goal = makeGoal({ id: 'g1', name: 'חיסכון' });
    const { urgency_score } = calculateUrgencyScore(goal);
    expect(urgency_score).toBeGreaterThanOrEqual(0);
    expect(urgency_score).toBeLessThanOrEqual(1);
  });

  it('priority 1 (most urgent) has higher priority_score than priority 10', () => {
    const urgent = makeGoal({ id: 'g1', name: 'דחוף', priority: 1 });
    const notUrgent = makeGoal({ id: 'g2', name: 'פחות דחוף', priority: 10 });
    expect(calculateUrgencyScore(urgent).priority_score).toBeGreaterThan(
      calculateUrgencyScore(notUrgent).priority_score
    );
  });

  it('priority 1 gives priority_score ≈ 1', () => {
    const goal = makeGoal({ id: 'g1', name: 'דחוף', priority: 1 });
    expect(calculateUrgencyScore(goal).priority_score).toBeCloseTo(1, 5);
  });

  it('priority 10 gives priority_score ≈ 0', () => {
    const goal = makeGoal({ id: 'g1', name: 'לא דחוף', priority: 10 });
    expect(calculateUrgencyScore(goal).priority_score).toBeCloseTo(0, 5);
  });

  it('overdue goal has time_proximity_score = 1', () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const goal = makeGoal({ id: 'g1', name: 'פג תוקף', deadline: pastDate });
    const { time_proximity_score } = calculateUrgencyScore(goal);
    expect(time_proximity_score).toBe(1);
  });

  it('goal without deadline has time_proximity_score = 0.5', () => {
    const goal = makeGoal({ id: 'g1', name: 'ללא דדליין' });
    const { time_proximity_score } = calculateUrgencyScore(goal);
    expect(time_proximity_score).toBe(0.5);
  });

  it('goal with far deadline has lower time_proximity_score', () => {
    const farDeadline = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000); // 3 years
    const closeDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const farGoal = makeGoal({ id: 'g1', name: 'רחוק', deadline: farDeadline, start_date: new Date(0) });
    const closeGoal = makeGoal({ id: 'g2', name: 'קרוב', deadline: closeDeadline, start_date: new Date(0) });
    expect(calculateUrgencyScore(farGoal).time_proximity_score).toBeLessThan(
      calculateUrgencyScore(closeGoal).time_proximity_score
    );
  });

  it('empty goal (current_amount = 0) has max progress_gap_score = 1', () => {
    const goal = makeGoal({ id: 'g1', name: 'חיסכון', current_amount: 0, target_amount: 10000 });
    const { progress_gap_score } = calculateUrgencyScore(goal);
    expect(progress_gap_score).toBe(1);
  });

  it('completed goal (current = target) has progress_gap_score = 0', () => {
    const goal = makeGoal({ id: 'g1', name: 'הושלם', current_amount: 10000, target_amount: 10000 });
    const { progress_gap_score } = calculateUrgencyScore(goal);
    expect(progress_gap_score).toBe(0);
  });

  it('half-completed goal has progress_gap_score ≈ 0.5', () => {
    const goal = makeGoal({ id: 'g1', name: 'חצי', current_amount: 5000, target_amount: 10000 });
    const { progress_gap_score } = calculateUrgencyScore(goal);
    expect(progress_gap_score).toBeCloseTo(0.5, 5);
  });

  it('urgency_score formula: 0.4*priority + 0.4*time + 0.2*gap', () => {
    // Goal with known values
    const goal = makeGoal({
      id: 'g1',
      name: 'בדיקת נוסחה',
      priority: 1,      // priority_score = 1
      current_amount: 0,
      target_amount: 10000, // progress_gap_score = 1
      // No deadline → time_proximity_score = 0.5
    });
    const expected = (1 * 0.4) + (0.5 * 0.4) + (1 * 0.2); // 0.4 + 0.2 + 0.2 = 0.8
    const { urgency_score } = calculateUrgencyScore(goal);
    expect(urgency_score).toBeCloseTo(expected, 5);
  });
});

// ============================================================================
// suggestPriorityAdjustments
// ============================================================================

describe('suggestPriorityAdjustments', () => {
  it('returns empty array for empty goals', () => {
    expect(suggestPriorityAdjustments([])).toHaveLength(0);
  });

  it('suggests raising priority for emergency_fund when priority > 2', () => {
    const emergencyFund = makeGoal({ id: 'g1', name: 'קרן חירום', goal_type: 'emergency_fund', priority: 5 });
    const suggestions = suggestPriorityAdjustments([emergencyFund]);
    const emergencySugg = suggestions.find(s => s.goal_id === 'g1');
    expect(emergencySugg).toBeDefined();
    expect(emergencySugg!.priority).toBe('high');
  });

  it('does not suggest raising emergency_fund priority when already <= 2', () => {
    const emergencyFund = makeGoal({ id: 'g1', name: 'קרן חירום', goal_type: 'emergency_fund', priority: 1 });
    const suggestions = suggestPriorityAdjustments([emergencyFund]);
    const emergencySugg = suggestions.find(s => s.goal_id === 'g1');
    expect(emergencySugg).toBeUndefined();
  });

  it('suggests lowering priority for long-term goals with high priority', () => {
    const futureDate = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000); // 3 years
    const longTerm = makeGoal({ id: 'g2', name: 'פנסיה', priority: 2, deadline: futureDate });
    const suggestions = suggestPriorityAdjustments([longTerm]);
    const longTermSugg = suggestions.find(s => s.message.includes('ארוכי טווח'));
    expect(longTermSugg).toBeDefined();
  });

  it('does not suggest lowering for short-term goals', () => {
    const nearDate = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months
    const shortTerm = makeGoal({ id: 'g1', name: 'חופשה', priority: 2, deadline: nearDate });
    const suggestions = suggestPriorityAdjustments([shortTerm]);
    const longTermSugg = suggestions.find(s => s.message.includes('ארוכי טווח'));
    expect(longTermSugg).toBeUndefined();
  });

  it('returns multiple suggestions when multiple conditions apply', () => {
    const emergencyFund = makeGoal({ id: 'g1', name: 'קרן חירום', goal_type: 'emergency_fund', priority: 8 });
    const futureDate = new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000);
    const longTerm1 = makeGoal({ id: 'g2', name: 'פנסיה', priority: 1, deadline: futureDate });
    const longTerm2 = makeGoal({ id: 'g3', name: 'דירה', priority: 2, deadline: futureDate });
    const suggestions = suggestPriorityAdjustments([emergencyFund, longTerm1, longTerm2]);
    expect(suggestions.length).toBeGreaterThan(0);
  });
});
