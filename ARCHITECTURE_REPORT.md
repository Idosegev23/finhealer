# FinHealer - Full Architecture Report
**Generated: 2026-02-22**

---

## 1. SYSTEM OVERVIEW

| Property | Value |
|----------|-------|
| Framework | Next.js 14 App Router |
| Database | Supabase PostgreSQL |
| WhatsApp | GreenAPI |
| AI Primary | Google Gemini 3/3.1 |
| AI Legacy | OpenAI GPT-5 (deprecated, still in code) |
| Email | Resend |
| UI Direction | RTL Hebrew |
| Font | Heebo |
| CSS | Tailwind + Shadcn UI |
| Charts | Recharts |
| Auth | Supabase Auth |

### Data Flow Summary
```
User sends WhatsApp message
  → GreenAPI webhook → /api/wa/webhook
    → Deduplication (DB + in-memory)
    → Phone normalization → User lookup/create
    → Message type routing:
       Text → phi-router.ts (state machine)
       Image → Gemini Vision OCR → transactions
       PDF → Gemini Pro Vision → transactions
       Excel → XLSX parse → Gemini Pro Deep → transactions
       Button → phi-router.ts
       Voice → Whisper transcription → phi-router.ts
    → Response via GreenAPI.sendMessage()
```

### State Machine Flow (Onboarding)
```
start → waiting_for_name → waiting_for_document
  → classification → classification_income / classification_expense
    → goals_setup → loan_consolidation_offer → waiting_for_loan_docs
      → behavior → goals → budget → monitoring (terminal)
```

### Phase System (Data-Based, NOT Time-Based)
```
Phase 1 "data_collection":  0-29 days of transaction data
Phase 2 "behavior":         30-59 days
Phase 3 "budget":           60-89 days
Phase 4 "goals":            90-119 days
Phase 5 "monitoring":       120+ days (4+ months)
```

---

## 2. DATABASE SCHEMA

### 2.1 Core Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| email | text | |
| phone | text | Normalized Israeli format |
| name | text | **Prefer over full_name** |
| full_name | text | Many users only have `name` |
| monthly_income | numeric | Declared income |
| wa_opt_in | boolean | WhatsApp permission |
| current_phase | text | data_collection/behavior/budget/goals/monitoring |
| onboarding_state | text | 12+ states (see state machine) |
| classification_context | JSONB | **MUST MERGE, never overwrite** |
| phase_updated_at | timestamp | When phase last changed |
| created_at | timestamp | |
| updated_at | timestamp | |

**classification_context JSONB keys:**
- `loanConsolidation` - loan flow state
- `advancedGoalCreation` - goal creation wizard state
- `editGoal` - goal editing state
- `autoAdjust` - income change adjustment state
- `optimization` - spending optimization state
- `goalCreation` - Phase 3 goal creation state
- `waitingForDocument` - document type being awaited
- `waitingForDocumentId` - missing document ID
- `waitingForCard` - credit card last 4 digits

#### `transactions` **CRITICAL: Uses `tx_date`, NOT `date`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK→users) | |
| type | text | 'income' / 'expense' |
| amount | numeric | |
| **tx_date** | date | **NOT `date`** |
| vendor | text | |
| description | text | |
| original_description | text | |
| category | text | General category |
| expense_category | text | Expense-specific category |
| income_category | text | Income-specific category |
| detailed_category | text | |
| sub_category | text | |
| expense_type | text | 'fixed' / 'variable' |
| expense_frequency | text | 'monthly' / 'one_time' / etc. |
| payment_method | text | |
| status | text | 'pending'/'proposed'/'confirmed'/'skipped'/'needs_credit_detail'/'duplicate_suspect' |
| source | text | 'ocr'/'excel'/'manual' |
| auto_categorized | boolean | |
| confidence_score | numeric | 0-1 |
| learned_from_pattern | boolean | |
| batch_id | text | Groups transactions from single upload |
| document_id | UUID (FK→uploaded_statements) | |
| receipt_id | UUID (FK→receipts) | |
| goal_id | UUID (FK→goals) | Links income to goal |
| is_source_transaction | boolean | TRUE only for bank statement txs |
| is_summary | boolean | Credit card summary line |
| statement_month | date | |
| needs_details | boolean | |
| card_number_last4 | text | |
| is_immediate_charge | boolean | |
| is_cash_expense | boolean | |
| replaced_by_transaction_id | UUID (FK→transactions) | |
| matching_status | text | 'not_matched'/'matched'/'pending_manual'/'pending_matching' |
| linked_document_id | UUID | |
| reconciliation_status | text | |
| notes | text | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `goals` (16 goal types)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK→users) | |
| name | text | |
| goal_type | text | See 16 types below |
| target_amount | numeric | |
| current_amount | numeric | |
| start_date | date | |
| deadline | date | |
| priority | integer | **1=most urgent, 10=least** |
| status | text | 'active'/'completed'/'cancelled'/'paused' |
| description | text | |
| child_name | text | |
| child_id | UUID (FK→children) | |
| budget_source | text | 'income'/'bonus'/'sale'/'inheritance'/'other' |
| funding_notes | text | |
| depends_on_goal_id | UUID (FK→goals) | |
| goal_group | text | Logical grouping |
| is_flexible | boolean | Can allocation vary |
| min_allocation | numeric | Minimum monthly |
| monthly_allocation | numeric | **Updated by balancer** |
| auto_adjust | boolean | Auto-adjust on income change |
| milestones | JSONB | [{percent, reached_at, celebrated}] |
| metadata | JSONB | {urgency_score, is_achievable, ...} |
| created_at | timestamp | |
| updated_at | timestamp | |

**16 Goal Types:**
1. `emergency_fund` - קרן חירום
2. `debt_payoff` - סגירת חובות
3. `savings_goal` - חיסכון למטרה
4. `general_improvement` - שיפור כללי
5. `retirement` - פנסיה
6. `education` - לימודים
7. `home_purchase` - רכישת דירה
8. `vehicle` - רכב
9. `vacation` - חופשה
10. `wedding` - חתונה
11. `renovation` - שיפוץ דירה
12. `real_estate_investment` - נכס להשקעה
13. `pension_increase` - הגדלת פנסיה
14. `child_savings` - חיסכון לילד
15. `family_savings` - חיסכון משפחתי
16. `other` - אחר

### 2.2 Financial Tables

#### `loans`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK→users) | |
| loan_type | text | |
| lender | text | Creditor name |
| original_amount | numeric | |
| current_balance | numeric | |
| interest_rate | numeric | |
| monthly_payment | numeric | |
| remaining_months | integer | |
| start_date | date | |
| end_date | date | |
| status | text | 'active'/'paid_off'/'refinanced'/'defaulted' |
| application_id | UUID | |
| metadata | JSONB | |

#### `loan_consolidation_requests`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK→users) | |
| loan_ids | UUID[] | Array of loan IDs |
| loans_count | integer | |
| total_monthly_payment | numeric | |
| total_balance | numeric | |
| status | text | See flow below |
| documents_received | integer | |
| documents_needed | integer | |
| loan_documents | JSONB | [{filename, url, loan_id, uploaded_at}] |
| lead_sent_at | timestamp | |
| lead_response | text | |
| advisor_notes | text | |
| proposed_rate | numeric | |
| proposed_monthly_payment | numeric | |
| proposed_total_amount | numeric | |
| estimated_savings | numeric | |
| created_at | timestamp | |
| updated_at | timestamp | |

**Consolidation Status Flow:**
```
pending_documents → documents_received → sent_to_advisor
  → advisor_reviewing → offer_sent → accepted/rejected/cancelled
```

#### `income_sources`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| name | text | |
| type | text | 'salary'/'freelance'/'business'/'passive'/'other' |
| amount | numeric | |
| frequency | text | |
| start_date | date | |
| end_date | date | |
| active | boolean | |
| gross_salary | numeric | From payslip |
| net_salary | numeric | |
| tax_deducted | numeric | |
| social_security | numeric | |
| pension_employee | numeric | |
| pension_employer | numeric | |
| metadata | JSONB | |

#### `savings_accounts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| account_name | text | |
| account_type | text | |
| bank_name | text | |
| account_number | text | |
| current_balance | numeric | |
| interest_rate | numeric | |
| opened_date | date | |
| maturity_date | date | |
| active | boolean | |
| goal_id | UUID (FK→goals) | Linked to goal |
| metadata | JSONB | |

#### `investments`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| investment_type | text | |
| provider | text | |
| account_number | text | |
| current_value | numeric | |
| invested_amount | numeric | |
| return_rate | numeric | |
| last_updated | timestamp | |
| metadata | JSONB | |

#### `insurance`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| policy_type | text | |
| provider | text | |
| policy_number | text | |
| coverage_amount | numeric | |
| monthly_premium | numeric | |
| annual_premium | numeric | |
| start_date | date | |
| end_date | date | |
| renewal_date | date | |
| status | text | |
| coverage_details | JSONB | |
| metadata | JSONB | |

#### `pensions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| pension_type | text | |
| provider | text | |
| policy_number | text | |
| current_balance | numeric | |
| monthly_deposit | numeric | |
| employer_deposit | numeric | |
| management_fees | numeric | |
| annual_return | numeric | |
| start_date | date | |
| metadata | JSONB | |

#### `bank_accounts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| bank_name | text | |
| account_name | text | |
| account_number | text | |
| account_type | text | |
| current_balance | numeric | |
| currency | text | |
| iban | text | |
| swift | text | |
| statement_format | text | |
| last_statement_date | date | |
| is_primary | boolean | |
| metadata | JSONB | |

### 2.3 Document & OCR Tables

#### `uploaded_statements`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| statement_type / file_type | text | 'bank_statement'/'credit_statement' |
| document_type | text | 'bank'/'credit'/'payslip'/etc. |
| file_name | text | |
| file_url | text | GreenAPI download URL |
| file_size | integer | |
| period_start | date | |
| period_end | date | |
| status | text | 'pending'/'processing'/'completed'/'failed' |
| processed | boolean | |
| processed_at | timestamp | |
| extracted_data | JSONB | Raw OCR output |
| transactions_extracted | integer | |
| transactions_created | integer | |
| user_validated | boolean | |
| created_at | timestamp | |
| updated_at | timestamp | |

#### `uploaded_documents`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| document_type | text | 'bank'/'credit'/'payslip'/'pension'/'insurance'/'loan'/'investment'/'savings'/'receipt'/'other' |
| sub_type | text | |
| file_name | text | |
| file_url | text | |
| file_size | integer | |
| mime_type | text | |
| period_start | date | |
| period_end | date | |
| status | text | |
| processing_time_ms | integer | |
| extracted_data | JSONB | |
| confidence_score | numeric | |
| transactions_extracted | integer | |
| error_message | text | |
| retry_count | integer | |
| metadata | JSONB | |

#### `receipts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| storage_path | text | Image URL |
| ocr_text | text | Raw OCR output |
| amount | numeric | |
| vendor | text | |
| tx_date | date | |
| receipt_number | text | |
| confidence | numeric | |
| status | text | 'completed' |
| metadata | JSONB | {document_type, source, model, total_items} |

#### `missing_documents`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| document_type | text | |
| card_last_4 | text | |
| charge_date | date | |
| period_start | date | |
| period_end | date | |
| expected_amount | numeric | |
| description | text | |
| status | text | |
| priority | integer | |

#### `document_corrections`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| document_id | UUID (FK) | |
| user_id | UUID (FK) | |
| field_name | text | |
| original_value | text | |
| corrected_value | text | |
| corrected_at | timestamp | |

#### `payslips`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| payment_date | date | |
| gross_salary | numeric | |
| net_salary | numeric | |
| tax_deducted | numeric | |
| social_security | numeric | |
| pension_employee | numeric | |
| pension_employer | numeric | |
| employer_contribution | numeric | |
| deductions | JSONB | |
| metadata | JSONB | |

### 2.4 Goals & Allocation Tables

#### `goal_milestones`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| goal_id | UUID (FK→goals) | |
| percent_reached | integer | 25/50/75/100 |
| amount_reached | numeric | |
| reached_at | timestamp | |
| celebrated | boolean | |
| celebration_sent_at | timestamp | |
| notes | text | |

#### `goal_allocations` / `goal_allocations_history`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| goal_id | UUID (FK→goals) | |
| month / calculation_date | date/timestamp | |
| monthly_allocation | numeric | |
| previous_allocation | numeric | |
| reason | text | initial_calculation/income_increased/etc. |
| confidence_score | numeric | |
| metadata | JSONB | {algorithm_version, total_budget, competing_goals_count} |

#### `user_income_forecast` / `income_forecasts`
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (FK) | |
| month | date | First day of month |
| forecasted_income | numeric | |
| confidence_score | numeric | 0-1 |
| based_on | text | 'historical_average'/'declared'/'seasonal_pattern'/'trending_up'/'trending_down' |
| variance_range | numeric | |
| metadata | JSONB | {months_of_data, seasonal_factors, trend_direction} |

### 2.5 Budget & Cash Flow Tables

#### `budgets`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| month | date | |
| total_budget | numeric | |
| savings_goal | numeric | |
| total_spent | numeric | |
| description | text | |
| status | text | |

#### `budget_categories`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| budget_id | UUID (FK→budgets) | |
| category_name | text | |
| allocated_amount | numeric | |
| threshold_percent | numeric | |

### 2.6 Behavior & Analytics Tables

#### `behavior_insights`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| insight_type | text | |
| category | text | |
| message | text | |
| severity | text | 'info'/'warning'/'alert' |
| data | JSONB | |
| detected_at | timestamp | |
| notification_sent | boolean | |

#### `user_patterns`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| pattern_type | text | |
| category | text | |
| frequency | text | |
| average_amount | numeric | |
| last_occurrence | timestamp | |
| metadata | JSONB | |

#### `recurring_patterns`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| name | text | |
| amount | numeric | |
| frequency | text | |
| category | text | |
| next_date | date | |
| active | boolean | |
| metadata | JSONB | |

### 2.7 Communication & State Tables

#### `wa_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| direction | text | 'incoming'/'outgoing' |
| msg_type | text | 'text'/'image'/etc. |
| payload | JSONB | Full GreenAPI payload |
| provider_msg_id | text | Unique - deduplication key |
| status | text | 'delivered' |

#### `conversation_context`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| phone_number | text | |
| context_type | text | |
| data | JSONB | Current flow state |
| expires_at | timestamp | |

#### `conversation_history`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| phone_number | text | |
| message_type | text | 'incoming'/'outgoing' |
| content | text | |
| context | JSONB | |
| sentiment | text | |
| response_needed | boolean | |
| status | text | |

#### `chat_messages`
Used for AI conversation history.

### 2.8 System Tables

#### `alerts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| type | text | 'daily_summary'/etc. |
| message | text | |
| status | text | |

#### `user_category_rules`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| vendor_pattern | text | |
| category | text | |
| expense_frequency | text | |
| confidence | numeric | |
| learn_count | integer | |
| times_used | integer | |
| last_used_at | timestamp | |
| auto_approved | boolean | Auto after 3 uses |

#### `expense_categories`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | text | |
| icon | text | |
| color | text | |
| user_defined | boolean | |
| order_index | integer | |

#### `user_financial_profile`
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK, FK) | |
| total_monthly_income | numeric | |
| total_fixed_expenses | numeric | |

#### `admin_users`
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (FK→users) | Admin permissions |

#### `children`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| name | text | |
| date_of_birth | date | |

#### `pending_tasks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | |
| task_type | text | |
| task_data | JSONB | |
| status | text | 'pending'/'completed'/'failed' |
| due_at | timestamp | |

#### `account_snapshots`
Point-in-time account balance snapshots.

#### `reconciliation_issues`
Mismatches between statements.

#### `usage_logs`
AI usage and cost tracking (tokens, estimated_cost).

### 2.9 Views (Materialized)

#### `cash_flow_projection`
12-month forward projection with income, expenses, net, balance, confidence, warnings.

#### `monthly_averages`
6-month rolling averages for income, fixed/variable expenses, data span.

### 2.10 RPC Functions

| Function | Parameters | Returns |
|----------|-----------|---------|
| `calculate_financial_health(p_user_id)` | UUID | φ score (0-100) |
| `get_dynamic_cash_flow_projection(p_user_id, p_months)` | UUID, INT | SETOF cash_flow_projection |
| `get_cash_flow_recommendations(p_user_id)` | UUID | Recommendations with impact |
| `get_overdue_recurring_patterns(p_user_id)` | UUID | Overdue recurring txs |
| `refresh_materialized_view(view_name)` | TEXT | Refreshes view |
| `check_goal_dependency_completion(goal_id)` | UUID | BOOLEAN |
| `create_milestone_if_reached(p_goal_id, p_current, p_target)` | UUID, numeric, numeric | Auto-creates milestone records |

### 2.11 Table Relationships
```
users (id)
├── transactions (user_id)
│   ├── goal_id → goals(id)
│   ├── document_id → uploaded_statements(id)
│   ├── receipt_id → receipts(id)
│   └── replaced_by_transaction_id → transactions(id)
├── goals (user_id)
│   ├── depends_on_goal_id → goals(id)
│   ├── child_id → children(id)
│   └── goal_milestones (goal_id)
├── budgets (user_id)
│   └── budget_categories (budget_id)
├── loans (user_id)
├── loan_consolidation_requests (user_id)
│   └── loan_ids[] → loans(id)
├── income_sources (user_id)
├── savings_accounts (user_id)
│   └── goal_id → goals(id)
├── investments (user_id)
├── insurance (user_id)
├── pensions (user_id)
├── uploaded_documents (user_id)
│   └── document_corrections (document_id)
├── uploaded_statements (user_id)
├── receipts (user_id)
├── bank_accounts (user_id)
├── payslips (user_id)
├── behavior_insights (user_id)
├── user_patterns (user_id)
├── recurring_patterns (user_id)
├── user_category_rules (user_id)
├── user_financial_profile (user_id)
├── user_income_forecast (user_id)
├── goal_allocations_history (user_id, goal_id)
├── conversation_context (user_id)
├── conversation_history (user_id)
├── wa_messages (user_id)
├── alerts (user_id)
├── pending_tasks (user_id)
├── account_snapshots (user_id)
├── usage_logs (user_id)
└── children (user_id)
```

---

## 3. API ROUTES

### 3.1 WhatsApp
| Method | Route | Purpose | Tables |
|--------|-------|---------|--------|
| POST | `/api/wa/webhook` | Incoming WhatsApp messages | wa_messages, users, transactions, receipts, uploaded_statements, missing_documents |
| POST | `/api/wa/chat` | AI chat endpoint | chat_messages, users, transactions, goals |

### 3.2 Goals
| Method | Route | Purpose | Tables |
|--------|-------|---------|--------|
| GET | `/api/goals` | List user goals | goals |
| POST | `/api/goals` | Create goal | goals |
| PATCH | `/api/goals` | Update goal | goals |
| DELETE | `/api/goals?id=` | Soft delete (cancel) | goals |
| POST | `/api/goals/balance` | Calculate allocations | goals, transactions, user_financial_profile, goal_allocations_history |
| POST | `/api/goals/simulate` | Income simulation | goals, transactions |

### 3.3 Loans
| Method | Route | Purpose | Tables |
|--------|-------|---------|--------|
| GET | `/api/loans/consolidation/[id]` | Get request details | loan_consolidation_requests, loans, users |
| POST | `/api/loans/consolidation/[id]/update` | Admin update status | loan_consolidation_requests |
| POST | `/api/loans/consolidation/[id]/send-lead` | Send lead to advisor | loan_consolidation_requests, users, loans |

### 3.4 Documents
| Method | Route | Purpose | Tables |
|--------|-------|---------|--------|
| POST | `/api/documents/process` | Process uploaded documents | uploaded_documents, transactions |
| POST | `/api/ocr/analyze-receipt` | OCR receipt analysis | receipts, transactions |
| POST | `/api/ocr/create-expenses` | Create expenses from OCR | transactions |

### 3.5 Cron Jobs
| Method | Route | Schedule | Purpose |
|--------|-------|----------|---------|
| GET | `/api/cron/daily-summary` | 20:30 daily | Daily spending summary + behavior analysis |
| GET | `/api/cron/weekly-summary` | Sun 09:00 | Week comparison + top categories |
| GET | `/api/cron/monthly-summary` | 1st 09:00 | Monthly report + infographic |
| GET | `/api/cron/monthly-review` | 1st 09:00 | Budget adherence + goal progress |

### 3.6 Other API Routes
- `/api/expenses` - CRUD for expenses
- `/api/income` - Income management
- `/api/transactions` - Transaction queries
- `/api/budget` - Budget CRUD
- `/api/dashboard` - Dashboard analytics
- `/api/user/profile` - User profile
- `/api/subscription` - Payment/subscription
- `/api/admin/*` - Admin endpoints
- `/api/exports` - Data export

---

## 4. DASHBOARD PAGES

### 4.1 Public Pages
| Page | Route | Purpose |
|------|-------|---------|
| Landing | `/` | Marketing page |
| Login | `/auth/login` | Supabase Auth login |
| Signup | `/auth/signup` | Registration |
| Payment | `/payment` | Subscription payment |
| Onboarding | `/onboarding` | Initial setup wizard |

### 4.2 Dashboard Pages
| Page | Route | Data Sources |
|------|-------|-------------|
| Main Dashboard | `/dashboard` | transactions, goals, budgets |
| Overview | `/dashboard/overview` | All financial data |
| Goals | `/dashboard/goals` | goals, goal_allocations |
| Expenses | `/dashboard/expenses` | transactions (expense) |
| Income | `/dashboard/income` | transactions (income), income_sources |
| Loans | `/dashboard/loans` | loans, loan_consolidation_requests |
| Savings | `/dashboard/savings` | savings_accounts |
| Insurance | `/dashboard/insurance` | insurance |
| Pensions | `/dashboard/pensions` | pensions |
| Investments | `/dashboard/investments` | investments |
| Budget | `/dashboard/budget` | budgets, budget_categories |
| Cash Flow | `/dashboard/cash-flow` | cash_flow_projection (RPC) |
| Transactions | `/dashboard/transactions` | transactions |
| Scan Center | `/dashboard/scan-center` | uploaded_documents |
| Settings | `/dashboard/settings` | users |
| Phase Dashboard | `/dashboard/phases` | Phase-specific views |
| Reports | `/dashboard/reports` | Aggregated data |
| Reflection | `/dashboard/reflection` | behavior_insights |
| Loans Simulator | `/dashboard/loans-simulator` | loans |

### 4.3 Admin Pages
| Page | Route | Purpose |
|------|-------|---------|
| Consolidation List | `/admin/consolidation` | All loan requests |
| Consolidation Detail | `/admin/consolidation/[id]` | Single request management |

### 4.4 Key Components (133 total)
| Component | Purpose | Data |
|-----------|---------|------|
| PhiSidebar | Navigation | User phase |
| PhiHeader | Top bar | User info |
| PhiScore | Financial health score | RPC calculate_financial_health |
| PhaseJourney | Phase progress visualization | users.current_phase |
| GoalCard | Individual goal display | goals |
| GoalModal | Create/edit goal | goals |
| GoalDepositModal | Deposit to goal | goals |
| BudgetCategoryChart | Category spending | budget_categories |
| CashFlowChart | 12-month projection | cash_flow_projection |
| TransactionList | Transaction table | transactions |
| FloatingWhatsAppButton | WhatsApp link | Static |
| BehaviorDashboard | Phase 2 dashboard | behavior_insights, transactions |

---

## 5. WHATSAPP FLOW - COMPLETE

### 5.1 Webhook Entry (`app/api/wa/webhook/route.ts`)

**Message Processing Pipeline:**
1. Parse GreenAPI webhook payload
2. Filter: only `incomingMessageReceived`
3. **Deduplication**: DB check (`wa_messages.provider_msg_id`) + in-memory Set (max 1000)
4. **Phone normalization**: Strip `@c.us`, `+`, `-`, spaces → generate 3 format variants
5. **User lookup**: `.in('phone', [variant1, variant2, variant3])`
6. **User creation**: If not found → create with `onboarding_state: 'waiting_for_name'`
7. **wa_opt_in**: Auto-enable if false
8. **Message save**: Insert to `wa_messages`
9. **Route by type**: text→phi-router, image→OCR, PDF→Gemini Vision, Excel→parse+Gemini, button→phi-router

### 5.2 State Machine (`lib/conversation/phi-router.ts` ~4600 lines)

**`routeMessage(userId, phone, message)` Flow:**
1. Create Supabase client + GreenAPI client
2. `getOrCreateContext(userId)` → load conversation context
3. `isContextStale()` → check 24h inactivity → `resumeStaleContext()` if stale
4. Fetch user: `name, full_name, onboarding_state`
5. Build RouterContext: `{userId, phone, state, userName}`
6. **State switch** (12+ handlers)
7. `updateContext()` → persist state

### 5.3 Monitoring State Commands (Terminal State)

| Command | Action |
|---------|--------|
| `הלוואה, איחוד, מסמכים, גדי` | Show loan consolidation status |
| `add_bank, עוד דוח בנק, דוח אשראי` | Request document upload |
| `start_classify, נתחיל, נמשיך` | Start transaction classification |
| `analyze, ניתוח` | Run behavior analysis |
| `to_goals, יעדים` | Transition to goals |
| `הפקדה ליעד, הפקדה:` | Goal deposit |
| `עזרה, פקודות, help, ?` | Show help menu |
| `סיכום, מצב, סטטוס, summary` | Show monitoring summary |
| `תקציב, budget, יתרות` | Show budget status |
| `גרף הכנסות` | Generate income chart |
| `גרף הוצאות, גרף` | Generate expense chart |
| Category name (fuzzy match) | Answer category question |
| **Default** | Gemini Flash AI chat response |

### 5.4 Classification Flow

**Pipeline:**
1. Verify uploaded documents exist
2. Load classifiable transactions (pending/proposed)
3. If none: check missing documents → advance to goals_setup
4. Display first transaction with AI suggestions
5. **User response handling:**
   - "דלג/skip" → skip (or mark needs_credit_detail if credit card)
   - "כן/confirm" → classify with top suggestion
   - Number (1-3) → classify with numbered suggestion
   - "רשימה/categories" → show full category list
   - Text → fuzzy match → AI fallback
6. **Expense grouping**: Same vendor transactions grouped together
7. **Credit card detection**: regex `/visa|mastercard|ויזה|מסטרקארד|אשראי/i`
8. **Learning**: `user_category_rules` updated, auto_approved after 3 uses

### 5.5 Goal Creation Flow (Advanced)

**Steps:** type → name → amount → deadline → priority → budget_source → [child] → confirm

**Context path:** `classification_context.advancedGoalCreation`

**Key fix applied:** goalContext check runs FIRST before general commands to prevent infinite loops.

### 5.6 Helper Functions in phi-router.ts

| Function | Line | Purpose |
|----------|------|---------|
| `startClassification()` | ~694 | Begin classification flow |
| `handleClassificationResponse()` | ~783 | Process classification input |
| `classifyTransaction()` | ~973 | Classify single transaction |
| `classifyGroup()` | ~1024 | Classify vendor group |
| `showNextTransaction()` | ~1085 | Display next for classification |
| `showNextExpenseGroup()` | ~1172 | Group expenses by vendor |
| `moveToNextPhase()` | ~1340 | Handle phase transitions |
| `moveToGoalsSetup()` | ~1408 | Transition to goals |
| `detectLoansFromClassifiedTransactions()` | ~1460 | Find loans in data |
| `showFinalSummary()` | ~1575 | Show onboarding summary |
| `generateAndSendExpenseChart()` | ~1660 | Create expense pie chart |
| `generateAndSendIncomeChart()` | ~1745 | Create income chart |
| `answerCategoryQuestion()` | ~1825 | Answer spending questions |
| `isCommand()` | ~1854 | Command matching (exact + fuzzy) |
| `learnUserRule()` | ~1960 | Save classification pattern |
| `getUserRuleSuggestion()` | ~2030 | Get learned suggestion |
| `handleBehaviorPhase()` | ~2090 | Phase 2 handler |
| `handleGoalsPhase()` | ~2290 | Phase 3 handler |
| `handleBudgetPhase()` | ~2420 | Phase 4 handler |
| `showMonitoringSummary()` | ~4088 | Show full summary |
| `showBudgetStatus()` | ~4130 | Show budget data |
| `mergeGoalCreationContext()` | helper | Safely merge goal context |

---

## 6. BUSINESS LOGIC (lib/)

### 6.1 AI Layer (`lib/ai/`)

| File | Functions | Model | Max Tokens |
|------|-----------|-------|------------|
| `gemini-client.ts` | `chatWithGeminiFlash()` | Gemini 3 Flash | 300 |
| | `chatWithGeminiFlashMinimal()` | Gemini 3 Flash | 500 |
| | `chatWithGeminiPro()` | Gemini 3.1 Pro | 2000 |
| | `chatWithGeminiProVision()` | Gemini 3.1 Pro | 8000 (JSON) |
| | `chatWithGeminiProVisionText()` | Gemini 3.1 Pro | 8000 (text) |
| | `chatWithGeminiProDeep()` | Gemini 3.1 Pro | 64000 |
| `gpt5-client.ts` | `chatWithGPT5()` | GPT-5.2 | 500 (DEPRECATED) |
| | `chatWithGPT5Fast()` | GPT-5-nano | 200 (DEPRECATED) |
| | `chatWithGPT5Deep()` | GPT-5.2 | 1000 (DEPRECATED) |
| | `transcribeVoice()` | Whisper-1 | N/A |
| `intent-parser.ts` | `tryRuleBasedParsing()` | None | N/A |
| | `aiBasedParsing()` | Gemini Flash | 500 |
| | `detectUserMood()` | None | N/A |

### 6.2 Goals Layer (`lib/goals/`)

| File | Key Functions | Tables Used |
|------|--------------|-------------|
| `goals-balancer.ts` | `calculateOptimalAllocations()` | goals, transactions, user_financial_profile, goal_allocations_history |
| `dependencies-handler.ts` | `sortGoalsByDependencies()`, `getDependencyReductionFactor()` | goals |
| `income-forecaster.ts` | `forecastIncome()` | transactions, user_income_forecast |
| `goals-monitor.ts` | `monitorUserGoals()` | goals, goal_allocations_history, transactions |
| `income-monitor.ts` | `detectIncomeChange()` | transactions, users |
| `auto-adjust-handler.ts` | `detectIncomeChangeAndPropose()`, `confirmAndApplyAdjustments()` | users, goals |
| `milestone-notifier.ts` | `sendMilestoneNotifications()` | goal_milestones, goals, users |
| `savings-sync.ts` | Goal-savings account sync | savings_accounts, goals |

**Goal Allocation Algorithm:**
```
Stage 1: Calculate available budget
  available = income - fixed_expenses - (30% living) - (10% safety)

Stage 2: Score urgency per goal
  urgency = (priority_score × 0.4) + (deadline_proximity × 0.4) + (progress_gap × 0.2)

Stage 3: Allocate
  Round 1: Minimum guarantees (min_allocation per goal)
  Round 2: Weighted proportional (urgency × flexibility_factor)
  Cap: No single goal > 40% of budget

Stage 4: Safety check
  remaining_for_life must be > 30% of income
```

### 6.3 Finance Layer (`lib/finance/`)

| File | Purpose | Categories |
|------|---------|------------|
| `categories.ts` | 150+ expense categories | Grouped by: מזון, דיור, תחבורה, בריאות, חינוך, etc. |
| `income-categories.ts` | Income category definitions | |
| `cash-flow-projector.ts` | 12-month cash flow projection | Uses RPC `get_dynamic_cash_flow_projection` |
| `cash-flow-alerts.ts` | Alert generation from projections | |

### 6.4 Analysis Layer (`lib/analysis/`)

| File | Purpose |
|------|---------|
| `behavior-analyzer.ts` | Spending pattern analysis via Gemini |
| `behavior-engine.ts` | Behavior scoring engine |
| `smart-budget-builder.ts` | AI-powered budget creation |

### 6.5 Conversation Layer (`lib/conversation/`)

| File | Purpose |
|------|---------|
| `phi-router.ts` | Main WhatsApp routing (~4600 lines) |
| `context-manager.ts` | Conversation context CRUD |
| `classification-flow.ts` | Transaction classification logic |
| `advanced-goals-handler.ts` | WhatsApp goal creation wizard |
| `goals-wa-handler.ts` | Goal-related message routing |
| `edit-goal-handler.ts` | Goal editing via WhatsApp |
| `history-loader.ts` | Load conversation history |

### 6.6 Documents Layer (`lib/documents/`)

| File | Purpose |
|------|---------|
| `period-tracker.ts` | Coverage calculation, duplicate detection, gap analysis |
| `smart-linker.ts` | Link transactions to documents |

### 6.7 Loans Layer (`lib/loans/`)

| File | Purpose |
|------|---------|
| `consolidation-handler.ts` | Loan consolidation WhatsApp flow |
| `lead-generator.ts` | Generate HTML lead email for advisor (Gadi) |

### 6.8 Learning Layer (`lib/learning/`)

| File | Purpose |
|------|---------|
| `pattern-detector.ts` | Detect recurring spending patterns |
| `smart-corrections.ts` | Learn from user corrections |

### 6.9 Classification Layer (`lib/classification/`)

| File | Purpose |
|------|---------|
| `bulk-classifier.ts` | Batch classification |
| `learning-engine.ts` | Classification learning |
| `recurring-detector.ts` | Detect recurring transactions |

### 6.10 Reconciliation Layer (`lib/reconciliation/`)

| File | Purpose |
|------|---------|
| `credit-matcher.ts` | Match credit card charges to bank transactions |

**Matching formula:** Amount ±2%, Date ±1 day, vendor contains credit card keywords.

### 6.11 Utils (`lib/utils/`)

| File | Purpose |
|------|---------|
| `phase-calculator.ts` | Phase determination from data span |
| `date-parser.ts` | Hebrew date parsing |
| `tax-calculator-2025.ts` | Israeli tax calculations |
| `phone-normalization.ts` | Phone number formatting |

---

## 7. CRON JOBS DETAIL

### Daily Summary (20:30 daily)
```
For each active user with wa_opt_in:
1. Batch load today's expense transactions
2. Run behavior analysis
3. Run income forecasting
4. Check budget phase readiness
5. Send WhatsApp daily summary
6. Save alert record
```

### Weekly Summary (Sunday 09:00)
```
For each user in behavior+ phase:
1. Batch load last 2 weeks transactions
2. Calculate week-over-week comparison
3. Top 5 categories
4. Insight if biggest category > 35% or change > 20%
5. Send WhatsApp with 500ms rate limit
```

### Monthly Summary (1st 09:00)
```
For each user in behavior+ phase:
1. Load last month transactions
2. Calculate income, expenses, balance, savings rate
3. Top 3 categories
4. Compare to previous month
5. Calculate φ Score: 50 + savings_bonus + comparison_bonus
6. Generate infographic image
7. Send WhatsApp text + image
```

### Monthly Review (1st 09:00)
```
For each user in budget+ phase:
1. Batch load transactions, budgets, goals
2. Budget adherence per category
3. Goal progress percentages
4. φ Score calculation
5. Send WhatsApp review
```

---

## 8. KEY CONSTANTS & THRESHOLDS

| Constant | Value | Used In |
|----------|-------|---------|
| MAX_GOAL_ALLOCATION_PERCENT | 40% | goals-balancer |
| DEFAULT_SAFETY_MARGIN | 10% of income | goals-balancer |
| MINIMUM_LIVING_BUDGET | 30% of income | goals-balancer |
| INCOME_CHANGE_THRESHOLD | 10% | income-monitor |
| AT_RISK_DEADLINE_DAYS | 30 | goals-monitor |
| STAGNANT_GOAL_MONTHS | 3 | goals-monitor |
| AMOUNT_TOLERANCE | ±2% | credit-matcher |
| DATE_TOLERANCE | ±1 day | credit-matcher |
| DUPLICATE_OVERLAP_HIGH | 80% | period-tracker |
| DUPLICATE_OVERLAP_PARTIAL | 30-80% | period-tracker |
| MIN_COVERAGE_MONTHS | 3 | period-tracker |
| CATEGORY_CONCERN_THRESHOLD | 35% | weekly-summary |
| EXPENSE_CHANGE_THRESHOLD | 20% | weekly-summary |
| AUTO_APPROVE_AFTER_USES | 3 | user_category_rules |
| CONTEXT_STALE_HOURS | 24 | phi-router |
| IN_MEMORY_DEDUP_MAX | 1000 | webhook |
| EXCEL_TIMEOUT | 120s | webhook |

---

## 9. GAPS, ISSUES & DISCONNECTIONS

### 9.1 CRITICAL ISSUES

| # | Issue | Location | Status |
|---|-------|----------|--------|
| 1 | **Double wa_messages insert** for text messages | webhook lines 355 + 404 | **BUG** |
| 2 | **No webhook signature verification** | webhook lines 228-233 | TODO |
| 3 | **No per-user rate limiting** on webhook | webhook | Missing |
| 4 | **`matchCreditTransactions()` imported but never called** | webhook line 1248-1295 | Dead code |
| 5 | **No Gemini OCR retry logic** | gemini-client.ts | Missing |
| 6 | **N+1 queries in monthly-summary cron** | monthly-summary lines 114-165 | Performance |
| 7 | **`classification` state never directly set** | phi-router line 217 | Potentially unreachable |
| 8 | **In-memory dedup lost on redeploy** | webhook processedMessages Set | Fragile |
| 9 | **GPT-5 client still in codebase** | gpt5-client.ts, smart-budget-builder.ts | Deprecated but used |
| 10 | **No real-time dashboard updates** | All dashboard pages | Manual refresh only |

### 9.2 MISSING FEATURES

| # | Feature | Impact |
|---|---------|--------|
| 1 | **No command to view needs_credit_detail transactions** | Users can't manage credit charges |
| 2 | **No multi-month visibility** | showMonitoringSummary has no month filter |
| 3 | **No unclassified transactions command in monitoring** | Users must wait for system prompt |
| 4 | **No duplicate payment detection** | Same vendor+amount+date can appear multiple times |
| 5 | **Missing categories**: "משכורות עובדים", "מסעדות" | User-reported gaps |
| 6 | **No "חיסכון מתוכנן" funding source** | User-reported gap |
| 7 | **Per-user custom category creation via WhatsApp** | `user_category_rules` exists but no WA command |

### 9.3 DISCONNECTIONS

| # | Source | Expected Connection | Actual |
|---|--------|-------------------|--------|
| 1 | `savings_accounts.goal_id` | Should sync with goals.current_amount | No automatic sync visible |
| 2 | `recurring_patterns` | Should predict next expenses | Detected but not used in cash flow |
| 3 | `account_snapshots` | Should track balance over time | Table exists, no writer found |
| 4 | `pending_tasks` | Should follow up with users | Table exists, no processor found |
| 5 | `document_corrections` | Should improve OCR accuracy | Table exists, no learning loop |
| 6 | `reconciliation_issues` | Should alert users | Table exists, minimal usage |
| 7 | Smart budget builder uses deprecated GPT-5 | Should use Gemini | Not migrated |
| 8 | `transaction_details` | Should link to source transactions | Linking exists but matcher not always called |

### 9.4 DASHBOARD-TO-DATA GAPS

| Dashboard Page | Missing Data/Feature |
|----------------|---------------------|
| Goals page | No dependency visualization |
| Cash flow page | No "what-if" scenarios beyond income slider |
| Budget page | No historical budget comparison |
| Expenses page | No recurring expense management |
| Loans page | No live status updates from consolidation flow |
| Insurance page | No coverage gap analysis |
| Pensions page | No retirement projection |

---

## 10. φ SCORE FORMULA

```
Base: 50

Savings Bonus:
  + min(30, savings_rate_percent)
  Where: savings_rate = ((income - expenses) / income) × 100

Expense Comparison:
  + 10 if current_expenses < previous_month_expenses
  - 10 if current_expenses > previous_month × 1.2

Final: max(0, min(100, score))

Display:
  90+ → 🏆
  70+ → 💪
  50+ → 📊
  30+ → 📉
  <30 → ⚠️
```

---

## 11. SECURITY CONSIDERATIONS

| Area | Status |
|------|--------|
| Auth | Supabase Auth (JWT) |
| RLS | 50+ policies on tables |
| Webhook auth | **NO signature verification** |
| Rate limiting | **NONE** |
| Admin protection | RLS + admin_users table |
| API key storage | Environment variables |
| Phone data | Normalized, no encryption at rest |
| JSONB context | Contains financial data, no field-level encryption |

---

*End of Architecture Report*
