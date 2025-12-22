/**
 * Phi Context Loader
 * 
 * טוען את כל ה-context הנדרש ל-AI בקריאה אחת.
 * זה הלב של הגישה AI-First - ה-AI מקבל הכל ומחליט הכל.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ============================================================================
// Types
// ============================================================================

export interface PhiFullContext {
  // User info
  user: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    currentPhase: string | null;
    onboardingState: string | null;
  };
  
  // Conversation history - last 20 messages
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  
  // Current state for classification
  classification: {
    currentTransaction: PendingTransaction | null;
    remainingCount: number;
    completedCount: number;
    totalCount: number;
  };
  
  // All pending transactions (for batch operations)
  pendingTransactions: PendingTransaction[];
  
  // Financial summary
  financialSummary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  } | null;
  
  // Category totals (for monitoring queries like "כמה הוצאתי על אוכל?")
  categoryTotals: Record<string, number>;
  
  // Learned patterns (vendor -> category)
  learnedPatterns: Record<string, string>;
  
  // Missing documents
  missingDocuments: Array<{
    type: string;
    description: string;
  }>;
  
  // Document coverage
  periodCoverage: {
    months: number;
    hasEnough: boolean;
    missingMonths: string[];
  };
  
  // Recently skipped transactions (for memory)
  recentlySkipped: Array<{
    vendor: string;
    amount: number;
    reason: string;
  }>;
  
  // Last bot message (for understanding context like "לדלג?")
  lastBotMessage: string | null;
  
  // Last user message (for understanding "כן" = same as before)
  lastUserMessage: string | null;
}

export interface PendingTransaction {
  id: string;
  amount: number;
  vendor: string;
  date: string;
  type: 'income' | 'expense';
  currentCategory: string | null;
  suggestedCategory: string | null;
  confidence: number;
  description: string | null;
}

// ============================================================================
// Main Loader Function
// ============================================================================

/**
 * טוען את כל ה-context של המשתמש מה-DB
 */
export async function loadFullContext(userId: string): Promise<PhiFullContext> {
  const supabase = createServiceClient();
  
  // טען הכל במקביל לביצועים טובים יותר
  const [
    userResult,
    messagesResult,
    pendingTxResult,
    confirmedTxResult,
    patternsResult,
    missingDocsResult,
    docsResult,
    skippedTxResult,
  ] = await Promise.all([
    // 1. User data
    supabase
      .from('users')
      .select('id, name, full_name, phone, email, current_phase, onboarding_state')
      .eq('id', userId)
      .single(),
    
    // 2. Recent messages (last 20)
    supabase
      .from('wa_messages')
      .select('direction, payload, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    
    // 3. Pending transactions
    supabase
      .from('transactions')
      .select('id, amount, vendor, tx_date, type, category, expense_category, confidence_score, original_description')
      .eq('user_id', userId)
      .eq('status', 'proposed')
      .order('tx_date', { ascending: false }),
    
    // 4. Confirmed transactions (for summary and category totals)
    supabase
      .from('transactions')
      .select('amount, type, category')
      .eq('user_id', userId)
      .eq('status', 'confirmed'),
    
    // 5. Learned patterns
    supabase
      .from('user_patterns')
      .select('vendor, category')
      .eq('user_id', userId),
    
    // 6. Missing documents
    supabase
      .from('missing_documents')
      .select('document_type, description')
      .eq('user_id', userId)
      .eq('status', 'pending'),
    
    // 7. Uploaded documents (for coverage)
    supabase
      .from('uploaded_statements')
      .select('period_start, period_end')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    
    // 8. Recently skipped transactions (for memory)
    supabase
      .from('transactions')
      .select('vendor, amount, notes')
      .eq('user_id', userId)
      .in('status', ['skipped', 'needs_credit_detail'])
      .order('updated_at', { ascending: false })
      .limit(10),
  ]);
  
  // Process user data
  const user = userResult.data;
  const userName = user?.full_name || user?.name || null;
  
  // Process messages - convert to chat format
  const messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }> = [];
  
  const rawMessages = (messagesResult.data || []).reverse(); // oldest first
  
  for (const msg of rawMessages) {
    // Extract text from payload
    let content = '';
    const payload = msg.payload as Record<string, unknown> | string | null;
    
    if (payload) {
      if (typeof payload === 'string') {
        content = payload;
      } else if (typeof payload === 'object') {
        if ('text' in payload && typeof payload.text === 'string') {
          content = payload.text;
        } else if ('textMessage' in payload && typeof payload.textMessage === 'string') {
          content = payload.textMessage;
        } else if ('message' in payload && typeof payload.message === 'string') {
          content = payload.message;
        }
      }
    }
    
    if (content && content.length > 0) {
      messages.push({
        role: msg.direction === 'incoming' ? 'user' : 'assistant',
        content,
        timestamp: msg.created_at || new Date().toISOString(),
      });
    }
  }
  
  // Process pending transactions
  const pendingTransactions: PendingTransaction[] = (pendingTxResult.data || []).map(tx => ({
    id: tx.id,
    amount: Math.abs(tx.amount),
    vendor: tx.vendor || 'לא ידוע',
    date: tx.tx_date || '',
    type: tx.type as 'income' | 'expense',
    currentCategory: tx.category || tx.expense_category || null,
    suggestedCategory: tx.expense_category || null,
    confidence: tx.confidence_score || 0.5,
    description: tx.original_description || null,
  }));
  
  // Calculate classification progress
  const totalPending = pendingTransactions.length;
  const currentTransaction = pendingTransactions.length > 0 ? pendingTransactions[0] : null;
  
  // Calculate financial summary and category totals
  let financialSummary = null;
  const categoryTotals: Record<string, number> = {};
  
  if (confirmedTxResult.data && confirmedTxResult.data.length > 0) {
    const confirmed = confirmedTxResult.data;
    const totalIncome = confirmed
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const totalExpenses = confirmed
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    financialSummary = {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      transactionCount: confirmed.length,
    };
    
    // Calculate category totals (expenses only)
    confirmed
      .filter(tx => tx.type === 'expense' && tx.category)
      .forEach(tx => {
        const cat = tx.category || 'אחר';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(tx.amount);
      });
  }
  
  // Process learned patterns
  const learnedPatterns: Record<string, string> = {};
  (patternsResult.data || []).forEach(p => {
    if (p.vendor && p.category) {
      learnedPatterns[p.vendor.toLowerCase()] = p.category;
    }
  });
  
  // Process missing documents
  const missingDocuments = (missingDocsResult.data || []).map(doc => ({
    type: doc.document_type,
    description: doc.description || '',
  }));
  
  // Calculate period coverage
  const docs = docsResult.data || [];
  const coveredMonths = new Set<string>();
  docs.forEach(doc => {
    if (doc.period_start && doc.period_end) {
      const start = new Date(doc.period_start);
      const end = new Date(doc.period_end);
      let current = new Date(start);
      while (current <= end) {
        coveredMonths.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
        current.setMonth(current.getMonth() + 1);
      }
    }
  });
  
  // Check which months are missing (last 3 months)
  const now = new Date();
  const requiredMonths: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    requiredMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const missingMonths = requiredMonths.filter(m => !coveredMonths.has(m));
  
  // Process recently skipped transactions
  const recentlySkipped = (skippedTxResult.data || []).map(tx => ({
    vendor: tx.vendor || 'לא ידוע',
    amount: Math.abs(tx.amount),
    reason: tx.notes || 'skipped',
  }));
  
  // Get last bot message and last user message for context
  const lastBotMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || null;
  const lastUserMessage = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || null;
  
  return {
    user: {
      id: userId,
      name: userName,
      phone: user?.phone || '',
      email: user?.email || null,
      currentPhase: user?.current_phase || null,
      onboardingState: user?.onboarding_state || null,
    },
    recentMessages: messages,
    classification: {
      currentTransaction,
      remainingCount: totalPending,
      completedCount: 0, // Will be calculated from confirmed count
      totalCount: totalPending,
    },
    pendingTransactions,
    financialSummary,
    categoryTotals,
    learnedPatterns,
    missingDocuments,
    periodCoverage: {
      months: coveredMonths.size,
      hasEnough: coveredMonths.size >= 3,
      missingMonths,
    },
    recentlySkipped,
    lastBotMessage,
    lastUserMessage,
  };
}

/**
 * קבלת ה-state הנוכחי מתוך ה-context
 */
export function getCurrentState(context: PhiFullContext): string {
  // אם יש onboarding_state מוגדר - השתמש בו
  if (context.user.onboardingState) {
    return context.user.onboardingState;
  }
  
  // אחרת, נסיק מהמצב
  if (!context.user.name) {
    return 'waiting_for_name';
  }
  
  if (context.pendingTransactions.length > 0) {
    return 'classification';
  }
  
  if (context.periodCoverage.months === 0) {
    return 'waiting_for_document';
  }
  
  return 'monitoring';
}

/**
 * פורמט מספר למטבע ישראלי
 */
export function formatCurrency(amount: number): string {
  return Math.abs(amount).toLocaleString('he-IL') + ' ₪';
}

export default { loadFullContext, getCurrentState, formatCurrency };

