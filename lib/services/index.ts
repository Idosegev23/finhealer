/**
 * Services Layer - Central business logic
 *
 * Import pattern:
 *   import { PhaseService, TransactionService } from '@/lib/services';
 *   const phase = await PhaseService.calculatePhase(userId);
 */

export * as PhaseService from './PhaseService';
export * as TransactionService from './TransactionService';
export * as NotificationService from './NotificationService';
export * as GoalService from './GoalService';
export * as ClassificationService from './ClassificationService';
