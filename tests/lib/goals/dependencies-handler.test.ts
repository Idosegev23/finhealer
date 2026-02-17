import { describe, it, expect } from 'vitest';
import {
  sortGoalsByDependencies,
  canGoalStart,
  getDependencyReductionFactor,
  detectCircularDependencies,
  getDependencyChain,
  generateDependencySuggestions,
} from '@/lib/goals/dependencies-handler';
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
// sortGoalsByDependencies
// ============================================================================

describe('sortGoalsByDependencies', () => {
  it('returns empty array for empty input', () => {
    expect(sortGoalsByDependencies([])).toEqual([]);
  });

  it('returns single goal as-is', () => {
    const goal = makeGoal({ id: 'g1', name: 'חיסכון' });
    const result = sortGoalsByDependencies([goal]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g1');
  });

  it('puts dependency before dependent goal', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן חירום' });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });

    const result = sortGoalsByDependencies([child, parent]);

    const parentIndex = result.findIndex(g => g.id === 'g1');
    const childIndex = result.findIndex(g => g.id === 'g2');
    expect(parentIndex).toBeLessThan(childIndex);
  });

  it('handles a chain of 3 dependencies in order', () => {
    const g1 = makeGoal({ id: 'g1', name: 'ראשון' });
    const g2 = makeGoal({ id: 'g2', name: 'שני', depends_on_goal_id: 'g1' });
    const g3 = makeGoal({ id: 'g3', name: 'שלישי', depends_on_goal_id: 'g2' });

    const result = sortGoalsByDependencies([g3, g2, g1]);

    const i1 = result.findIndex(g => g.id === 'g1');
    const i2 = result.findIndex(g => g.id === 'g2');
    const i3 = result.findIndex(g => g.id === 'g3');
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
  });

  it('handles independent goals without crashes', () => {
    const g1 = makeGoal({ id: 'g1', name: 'יעד א' });
    const g2 = makeGoal({ id: 'g2', name: 'יעד ב' });
    const result = sortGoalsByDependencies([g1, g2]);
    expect(result).toHaveLength(2);
  });

  it('handles circular dependency gracefully (no infinite loop)', () => {
    const g1 = makeGoal({ id: 'g1', name: 'א', depends_on_goal_id: 'g2' });
    const g2 = makeGoal({ id: 'g2', name: 'ב', depends_on_goal_id: 'g1' });
    // Should not throw or loop forever
    expect(() => sortGoalsByDependencies([g1, g2])).not.toThrow();
  });
});

// ============================================================================
// canGoalStart
// ============================================================================

describe('canGoalStart', () => {
  it('returns true when goal has no dependency', () => {
    const goal = makeGoal({ id: 'g1', name: 'חיסכון' });
    expect(canGoalStart(goal, [])).toBe(true);
  });

  it('returns true when dependency is completed', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן חירום', status: 'completed' });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    expect(canGoalStart(child, [parent, child])).toBe(true);
  });

  it('returns false when dependency is still active', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן חירום', status: 'active' });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    expect(canGoalStart(child, [parent, child])).toBe(false);
  });

  it('returns true when dependency goal does not exist', () => {
    const child = makeGoal({ id: 'g1', name: 'חיסכון', depends_on_goal_id: 'non-existent' });
    expect(canGoalStart(child, [child])).toBe(true);
  });
});

// ============================================================================
// getDependencyReductionFactor
// ============================================================================

describe('getDependencyReductionFactor', () => {
  it('returns 1.0 for goal without dependency', () => {
    const goal = makeGoal({ id: 'g1', name: 'חיסכון' });
    expect(getDependencyReductionFactor(goal, [])).toBe(1.0);
  });

  it('returns 1.0 when dependency is completed', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן חירום', status: 'completed' });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    expect(getDependencyReductionFactor(child, [parent, child])).toBe(1.0);
  });

  it('returns 1.0 when dependency not found', () => {
    const child = makeGoal({ id: 'g1', name: 'חיסכון', depends_on_goal_id: 'missing' });
    expect(getDependencyReductionFactor(child, [child])).toBe(1.0);
  });

  it('returns 0.3 (default) when dependency is active and <50% complete', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן', status: 'active', target_amount: 10000, current_amount: 2000 });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    expect(getDependencyReductionFactor(child, [parent, child])).toBe(0.3);
  });

  it('returns 0.6 when dependency is >50% complete', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן', status: 'active', target_amount: 10000, current_amount: 6000 });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    expect(getDependencyReductionFactor(child, [parent, child])).toBe(0.6);
  });

  it('returns custom defaultReduction when provided', () => {
    const parent = makeGoal({ id: 'g1', name: 'קרן', status: 'active', target_amount: 10000, current_amount: 1000 });
    const child = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    expect(getDependencyReductionFactor(child, [parent, child], 0.5)).toBe(0.5);
  });
});

// ============================================================================
// detectCircularDependencies
// ============================================================================

describe('detectCircularDependencies', () => {
  it('returns empty array when no circular dependencies', () => {
    const g1 = makeGoal({ id: 'g1', name: 'ראשון' });
    const g2 = makeGoal({ id: 'g2', name: 'שני', depends_on_goal_id: 'g1' });
    expect(detectCircularDependencies([g1, g2])).toHaveLength(0);
  });

  it('detects simple circular dependency (A→B, B→A)', () => {
    const g1 = makeGoal({ id: 'g1', name: 'א', depends_on_goal_id: 'g2' });
    const g2 = makeGoal({ id: 'g2', name: 'ב', depends_on_goal_id: 'g1' });
    const warnings = detectCircularDependencies([g1, g2]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('returns empty array for goals with no dependencies', () => {
    const g1 = makeGoal({ id: 'g1', name: 'א' });
    const g2 = makeGoal({ id: 'g2', name: 'ב' });
    expect(detectCircularDependencies([g1, g2])).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(detectCircularDependencies([])).toHaveLength(0);
  });
});

// ============================================================================
// getDependencyChain
// ============================================================================

describe('getDependencyChain', () => {
  it('returns single-element chain for goal with no dependency', () => {
    const goal = makeGoal({ id: 'g1', name: 'חיסכון' });
    const chain = getDependencyChain(goal, [goal]);
    expect(chain).toHaveLength(1);
    expect(chain[0].id).toBe('g1');
  });

  it('returns chain in order: dependency first, goal last', () => {
    const g1 = makeGoal({ id: 'g1', name: 'קרן חירום' });
    const g2 = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    const chain = getDependencyChain(g2, [g1, g2]);
    expect(chain[0].id).toBe('g1');
    expect(chain[1].id).toBe('g2');
  });

  it('returns full chain for 3-level dependency', () => {
    const g1 = makeGoal({ id: 'g1', name: 'ראשון' });
    const g2 = makeGoal({ id: 'g2', name: 'שני', depends_on_goal_id: 'g1' });
    const g3 = makeGoal({ id: 'g3', name: 'שלישי', depends_on_goal_id: 'g2' });
    const chain = getDependencyChain(g3, [g1, g2, g3]);
    expect(chain).toHaveLength(3);
    expect(chain[0].id).toBe('g1');
    expect(chain[2].id).toBe('g3');
  });
});

// ============================================================================
// generateDependencySuggestions
// ============================================================================

describe('generateDependencySuggestions', () => {
  it('returns empty array when no blocked goals', () => {
    const g1 = makeGoal({ id: 'g1', name: 'קרן חירום', status: 'completed' });
    const g2 = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1' });
    const suggestions = generateDependencySuggestions([g1, g2], []);
    // g2 can start because g1 is completed → no blocked goals
    expect(suggestions).toHaveLength(0);
  });

  it('generates suggestion for blocked goal', () => {
    const g1 = makeGoal({ id: 'g1', name: 'קרן חירום', status: 'active', target_amount: 10000, current_amount: 1000 });
    const g2 = makeGoal({ id: 'g2', name: 'חיסכון לחופשה', depends_on_goal_id: 'g1', status: 'active' });
    const suggestions = generateDependencySuggestions([g1, g2], []);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].message).toContain('חיסכון לחופשה');
  });

  it('adds circular dependency suggestion when warnings contain circular text', () => {
    const g1 = makeGoal({ id: 'g1', name: 'א', depends_on_goal_id: 'g2', status: 'active' });
    const g2 = makeGoal({ id: 'g2', name: 'ב', depends_on_goal_id: 'g1', status: 'active' });
    const warnings = ['⚠️ תלות מעגלית זוהתה ביעד "א"'];
    const suggestions = generateDependencySuggestions([g1, g2], warnings);
    const circularSuggestion = suggestions.find(s => s.message.includes('תלות מעגלית') || s.type === 'remove_goal');
    expect(circularSuggestion).toBeDefined();
  });

  it('marks high priority when dependency progress < 25%', () => {
    const g1 = makeGoal({ id: 'g1', name: 'קרן', status: 'active', target_amount: 10000, current_amount: 500 });
    const g2 = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1', status: 'active' });
    const suggestions = generateDependencySuggestions([g1, g2], []);
    expect(suggestions[0].priority).toBe('high');
  });

  it('marks medium priority when dependency progress >= 25%', () => {
    const g1 = makeGoal({ id: 'g1', name: 'קרן', status: 'active', target_amount: 10000, current_amount: 3000 });
    const g2 = makeGoal({ id: 'g2', name: 'חיסכון', depends_on_goal_id: 'g1', status: 'active' });
    const suggestions = generateDependencySuggestions([g1, g2], []);
    expect(suggestions[0].priority).toBe('medium');
  });
});
