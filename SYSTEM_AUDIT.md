# FinHealer System Audit — 2026-03-18

## Data Flow Map

```
┌──────────────────────────────────────────────────────────────────┐
│  INPUT CHANNELS                                                   │
│                                                                   │
│  WhatsApp Bot ──→ "סופר 450" ──→ add_expense intent             │
│  Web Manual   ──→ QuickExpenseForm / data/expenses               │
│  Doc Upload   ──→ OCR (Gemini) ──→ saveBankTransactions          │
│  Cron Auto    ──→ auto-populate-financials                       │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  TRANSACTIONS TABLE (source of truth)                             │
│                                                                   │
│  Fields: tx_date, amount, type, status(pending|confirmed),       │
│          expense_category, expense_type, vendor, source,          │
│          is_summary, is_recurring, financial_account_id           │
│                                                                   │
│  Filters: ALWAYS use:                                            │
│    .eq('status', 'confirmed')                                     │
│    .or('is_summary.is.null,is_summary.eq.false')                 │
└──────────────┬───────────────────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  CONSUMERS                                                        │
│                                                                   │
│  BudgetSyncService ──→ budgets.total_spent                       │
│                    └──→ budget_categories.spent_amount             │
│     Called from: transactions API, WhatsApp handler,              │
│                  document processing, hourly-alerts cron          │
│                                                                   │
│  Dashboard KPIs ──→ on-read SUM(amount) ✅                       │
│  Financial Profile ──→ auto-populate cron (daily) ✅              │
│  Phi Score ──→ calculate_financial_health RPC ✅                  │
│  Behavior Analysis ──→ analyze-patterns cron (daily 2am) ✅      │
│  Recurring Detection ──→ check-recurring cron (daily) ✅         │
│  Cash Flow ──→ cash-flow-projector (on-read) ✅                  │
│                                                                   │
│  ALERTS (hourly-alerts cron):                                     │
│    1. syncAllBudgets() → recalculate spending                    │
│    2. Read budgets.total_spent → check thresholds                │
│    3. Read budget_categories.spent_amount → category alerts      │
│    4. Send WhatsApp if exceeded/warning                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  SCHEDULED JOBS                                                   │
│                                                                   │
│  Every hour:  hourly-alerts (budget check)                       │
│  Daily 00:00: check-recurring (pattern matching)                 │
│  Daily 02:00: analyze-patterns + update-phases + savings-sync    │
│  Daily 08:00: cash-flow-alerts                                   │
│  Daily 09:00: goals-check + monitor-income                       │
│  Daily 10:00: goals milestone notifications                      │
│  Daily 11:00: re-engagement                                      │
│  Daily 20:00: evening-reminder ("היו לך הוצאות היום?")          │
│  Daily 20:30: daily-summary                                      │
│  Sunday 10:00: weekly-summary                                    │
│  1st of month: monthly-review + monthly-budget                   │
│  Custom:      auto-populate-financials                           │
└──────────────────────────────────────────────────────────────────┘
```

## Audit Findings

### CRITICAL (must fix now)

| # | Issue | File | Line |
|---|-------|------|------|
| 1 | Missing `is_summary` filter in export | `api/profile/export-data/route.ts` | 31 |
| 2 | `createServiceClient` in user-facing welcome API | `api/wa/welcome/route.ts` | 11,23 |
| 3 | `createServiceClient` in user-facing export API | `api/export/transactions/route.ts` | 7,12 |

### HIGH (data integrity / field bugs)

| # | Issue | File | Line |
|---|-------|------|------|
| 4 | Writing `full_name` alongside `name` | `lib/conversation/states/onboarding.ts` | 72 |
| 5 | Using `date` field (doesn't exist) | `api/expenses/update/route.ts` | 47 |
| 6 | Duplicate `notes` property | `lib/webhook/handle-pdf.ts` | 260-261 |

### SCHEMA (stale migrations, won't break runtime)

| # | Issue | File |
|---|-------|------|
| 7 | Migration creates `current_phase` (should be `phase`) | `supabase/migrations/20251201_behavior_insights.sql` |
| 8 | Migration uses `proposed` status (only pending/confirmed valid) | `supabase/migrations/20250131_comprehensive_360_system.sql` |

### CODE QUALITY

- 25+ files with `@ts-nocheck`
- No webhook signature verification
- No per-user rate limiting on WhatsApp webhook
