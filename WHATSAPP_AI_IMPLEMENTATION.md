# WhatsApp AI-First System - Implementation Guide

## 🎯 Overview

This document describes the complete WhatsApp AI-first implementation for Phi (φ). The system uses GPT-5.1 with natural language understanding, pattern learning, and proactive insights.

## 📊 Architecture

```
WhatsApp Message
      ↓
Enhanced Webhook Handler
      ↓
Conversation Orchestrator
      ↓
┌─────────────────┬──────────────────┬─────────────────┐
│   Intent Parser │  State Machine   │  Context Manager│
└─────────────────┴──────────────────┴─────────────────┘
      ↓                    ↓                    ↓
┌─────────────────┬──────────────────┬─────────────────┐
│  Expense Flow   │ Classification   │  Learning Engine│
└─────────────────┴──────────────────┴─────────────────┘
      ↓
GPT-5.1 AI Engine
      ↓
WhatsApp Response
```

## 🚀 Key Features Implemented

### 1. AI Core (Phase 1)
- **GPT-5.1 Integration** (`lib/ai/gpt5-client.ts`)
  - Fast mode (reasoning: none) for quick responses
  - Deep mode (reasoning: high) for complex analysis
  - Chain-of-thought persistence with `previous_response_id`

- **Intent Parser** (`lib/ai/intent-parser.ts`)
  - Hebrew NLU with rule-based + AI hybrid approach
  - Entity extraction: amounts, dates, categories, merchants
  - Confidence scoring for all predictions

- **System Prompts** (`lib/ai/prompts/`)
  - Phi Coach personality (casual Hebrew, friendly, non-overwhelming)
  - Conversation rules (max questions, break offers, mood detection)
  - Entity extraction templates for financial data

### 2. Conversation Management (Phase 2)
- **State Machine** (`lib/conversation/state-machine.ts`)
  - States: idle, onboarding, classification, active_monitoring, paused
  - Valid transitions with conditions
  - State-specific welcome messages

- **Context Manager** (`lib/conversation/context-manager.ts`)
  - Persistent conversation state in Supabase
  - Stale context detection and recovery
  - Postponement tracking (backs off after 3 postponements)

- **Follow-up Manager** (`lib/conversation/follow-up-manager.ts`)
  - Smart scheduling based on user preferences
  - Natural language time parsing ("מחר", "ערב")
  - Escalation logic for no-response scenarios

### 3. Learning & Patterns (Phase 3)
- **Pattern Detector** (`lib/learning/pattern-detector.ts`)
  - Merchant → Category patterns (60%+ confidence)
  - Subscription detection (recurring amounts/dates)
  - Day-of-week spending patterns
  - Amount range categorization

- **Smart Corrections** (`lib/learning/smart-corrections.ts`)
  - Learn from user corrections
  - Adjust pattern confidence dynamically
  - Batch processing for pattern creation

- **Auto-categorization**
  - 0-50%: Ask every time
  - 50-80%: Auto-fill with confirmation
  - 80-95%: Auto-fill with notification
  - 95%+: Full automation

### 4. WhatsApp Enhancement (Phase 4)
- **Voice Handler** (`lib/whatsapp/voice-handler.ts`)
  - Whisper API integration for Hebrew transcription
  - Audio download from GreenAPI
  - Confirmation messages with transcription

- **Engagement Manager** (`lib/whatsapp/engagement-manager.ts`)
  - Don't overwhelm logic (max 50 transactions/session)
  - Break offers every 3 questions
  - Frustration detection
  - Quiet hours (22:00-08:00)

- **Smart Document Linker** (`lib/documents/smart-linker.ts`)
  - Credit card payment → statement linking
  - Duplicate document detection
  - Proactive document requests

### 5. Natural Conversations (Phase 5)
- **Expense Logging Flow** (`lib/conversation/flows/expense-logging-flow.ts`)
  - Natural expense extraction
  - Correction handling
  - Pattern matching

- **Classification Flow** (`lib/conversation/flows/transaction-classification-flow.ts`)
  - Bulk transaction classification
  - Progress indicators
  - Smart completion messages

- **Response Templates** (`lib/ai/response-templates.ts`)
  - Variety in confirmations, approvals, greetings
  - Mood-based responses
  - Avoid repetition

### 6. Proactive Features (Phase 6)
- **Reminder System** (`lib/proactive/reminder-system.ts`)
  - Salary reminders
  - Expense logging reminders
  - Bill payment reminders
  - Goal milestone celebrations
  - Quiet hours respect

- **Insights Generator** (`lib/proactive/insights-generator.ts`)
  - Overspending detection
  - Savings opportunities
  - Upcoming bills analysis
  - Goal progress tracking
  - Spending pattern insights
  - Anomaly detection

### 7. Main Orchestrator
- **Conversation Orchestrator** (`lib/conversation/orchestrator.ts`)
  - Central routing system
  - State-based handler selection
  - Frustration detection and apology
  - Postponement management
  - Action execution (create transaction, etc.)

## 🗄️ Database Schema

New tables added in `supabase/migrations/20251124_whatsapp_ai_system.sql`:

### Core Tables
- `conversation_history` - All messages with intent/entities
- `conversation_context` - Current state per user
- `pending_tasks` - Ongoing classification/onboarding tasks
- `user_preferences` - Communication style, reminder settings
- `reminders` - Scheduled follow-ups and notifications

### Learning Tables
- `user_patterns` - Learned merchant/category/subscription patterns
- `pattern_corrections` - User corrections for learning

### Enhanced Columns
- `transactions.learned_from_pattern` - Auto-categorized
- `transactions.confidence_score` - Prediction confidence
- `transactions.requires_confirmation` - Needs approval
- `transactions.ai_suggested_category` - AI suggestion
- `transactions.source` - manual/bank_import/ai_whatsapp/ocr

## 🔌 API Endpoints

### Main Chat API
```
POST /api/ai/chat
{
  "userId": "uuid",
  "message": "קניתי קפה 28 שקל",
  "messageType": "text|voice",
  "phoneNumber": "972547667775",
  "audioUrl": "https://..." // for voice messages
}
```

### Cron Jobs
```
GET /api/cron/reminders
Authorization: Bearer <CRON_SECRET>

Runs every 15 minutes:
- Process due reminders
- Send proactive insights (9 AM only)
```

## 🎨 User Experience Flows

### Flow 1: Simple Expense Logging
```
User: "50 שקל קפה"
φ: "רשמתי 50 ₪ על קפה. נכון?"

User: "לא 28"
φ: "אוקיי תיקנתי ל-28 ₪ ✓"
```

### Flow 2: Transaction Classification
```
φ: "מצאתי 47 תנועות. יש לי כמה שאלות. בא לך?"

User: "כן"
φ: "מעולה! בוא נתחיל עם הכנסות.
   ב-9/11 הכנסה של 4,587 ₪ מאיילון. מה זה?"

User: "משכורת"
φ: "מעולה. נמשיך?"

[After 3 questions]
φ: "יש לי עוד 44 שאלות. רוצה הפסקה?"
```

### Flow 3: Smart Document Linking
```
φ: "מצאתי תשלום אשראי של 17,000 ₪ ב-15/11.
   כדי לפרט את ההוצאות, אני צריך את דוח האשראי עד 15/11.
   
   יש לך? 📄"

[User uploads credit card statement]
φ: "מעולה! אני מקשר את התנועות... ✓"
```

### Flow 4: Proactive Insight
```
φ: "שמתי לב שהוצאות המזון עלו ב-35% החודש 📊
   
   רוצה לראות איפה?"

User: "כן"
φ: "הנה הפירוט: [link to dashboard with filters]"
```

## 🚦 Confidence Levels & Behavior

| Confidence | Behavior | Example |
|---|---|---|
| 0-50% | Always ask | "מה הקטגוריה?" |
| 50-80% | Suggest & confirm | "זה מזון?" |
| 80-95% | Auto-fill + notify | "רשמתי במזון ✓" |
| 95%+ | Silent auto | (no message, just log) |

## ⚙️ Configuration

### Environment Variables
```env
OPENAI_API_KEY=sk-...
CRON_SECRET=<random-secret>
GREEN_API_INSTANCE_ID=<your-instance>
GREEN_API_TOKEN=<your-token>
```

### User Preferences
Can be set in `user_preferences` table:
- `communication_style`: casual / formal
- `reminder_frequency`: minimal / normal / frequent
- `preferred_reminder_time`: HH:MM
- `auto_categorize_threshold`: 0.0-1.0
- `voice_messages_enabled`: boolean
- `gamification_enabled`: boolean

## 🧪 Testing

### Test Voice Message
```bash
curl -X POST https://your-domain.com/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "messageType": "voice",
    "phoneNumber": "972547667775",
    "audioUrl": "https://example.com/audio.ogg"
  }'
```

### Test Insights
```bash
curl -X POST https://your-domain.com/api/cron/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test_insights",
    "userId": "user-id"
  }'
```

### Test Pattern Detection
```typescript
import { detectPatterns } from "@/lib/learning/pattern-detector";

const patterns = await detectPatterns(userId);
console.log(patterns);
```

## 📈 Monitoring

Track these metrics:
- **Intent Recognition Accuracy**: % correctly identified intents
- **Auto-categorization Success**: % auto-categorized correctly
- **Conversation Completion Rate**: % finished classification sessions
- **User Satisfaction**: Inferred from conversation (tone, corrections)
- **Response Time**: Average bot response latency
- **Pattern Learning Rate**: New patterns learned per user

## 🔒 Security & Privacy

- **RLS Policies**: All new tables have user-level RLS
- **No Sensitive Data in Logs**: Don't log full messages
- **Rate Limiting**: 100 messages/day per user
- **Webhook Verification**: Optional signature verification
- **CRON_SECRET**: Protect cron endpoints

## 🚀 Deployment Checklist

1. ✅ Run database migration: `supabase/migrations/20251124_whatsapp_ai_system.sql`
2. ✅ Set environment variables
3. ✅ Deploy to Vercel
4. ✅ Configure Vercel Cron (every 15 minutes)
5. ✅ Test with a real user conversation
6. ✅ Monitor logs for errors
7. ✅ Track metrics in dashboard

## 🎓 Future Enhancements

- **Voice Response**: Send voice messages back
- **Multi-language**: Support English/Arabic
- **Family Accounts**: Multiple users per phone
- **Smart Goals**: AI-suggested savings goals
- **Spending Predictions**: Forecast next month
- **Bill Negotiation**: Suggest cheaper alternatives
- **Receipt Auto-upload**: Auto-detect receipt photos
- **Location Context**: "הוצאתי פה 120 שקל" with GPS

## 📚 Code Organization

```
lib/
├── ai/
│   ├── gpt5-client.ts          # GPT-5.1 API client
│   ├── intent-parser.ts        # Intent & entity extraction
│   ├── response-templates.ts   # Response variety
│   └── prompts/
│       ├── phi-coach-system.ts         # Main personality
│       ├── conversation-rules.ts       # Behavioral rules
│       └── entity-extraction.ts        # Financial entities
├── conversation/
│   ├── orchestrator.ts         # Main routing system
│   ├── state-machine.ts        # State management
│   ├── context-manager.ts      # Context persistence
│   ├── follow-up-manager.ts    # Reminders & follow-ups
│   └── flows/
│       ├── expense-logging-flow.ts     # Expense conversations
│       └── transaction-classification-flow.ts
├── learning/
│   ├── pattern-detector.ts     # Pattern discovery
│   └── smart-corrections.ts    # Learning from mistakes
├── whatsapp/
│   ├── voice-handler.ts        # Voice transcription
│   ├── engagement-manager.ts   # Don't overwhelm logic
│   └── (existing files)
├── documents/
│   └── smart-linker.ts         # Document relationships
└── proactive/
    ├── reminder-system.ts      # Scheduled reminders
    └── insights-generator.ts   # Financial insights

app/api/
├── ai/
│   └── chat/route.ts           # Main chat endpoint
└── cron/
    └── reminders/route.ts      # Cron job
```

## 💡 Key Principles

1. **Never Overwhelming**: Respect user's time and mood
2. **Always Learning**: Get smarter with each interaction
3. **Proactive but Polite**: Offer insights, don't push
4. **Forgiving**: Understand typos, slang, corrections
5. **Fast**: Sub-second response times
6. **Context-Aware**: Remember conversations
7. **Graceful Failures**: Work even if AI fails

---

**Built with φ (Phi) - היחס הזהב של הכסף שלך** 💰

