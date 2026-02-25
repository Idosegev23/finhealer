/**
 * φ Router - COMPATIBILITY WRAPPER
 *
 * This file re-exports from the new modular router.
 * The actual logic is in:
 *   - router.ts (thin router, ~250 lines)
 *   - states/onboarding.ts
 *   - states/classification.ts
 *   - states/behavior.ts
 *   - states/goals.ts
 *   - states/budget.ts
 *   - states/monitoring.ts
 *   - shared.ts (types + utilities)
 *
 * All existing imports of phi-router.ts continue to work.
 */

export { routeMessage, onClassificationComplete, onDocumentProcessed } from './router';
export type { RouterContext, RouterResult, UserState } from './shared';
