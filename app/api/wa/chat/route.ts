// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildContextMessage, parseExpenseFromAI, type UserContext } from '@/lib/ai/system-prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/wa/chat
 * 
 * שיחה חופשית עם AI Assistant
 * - מקבל הודעה מהמשתמש
 * - שולף context (פרופיל, תקציב, יעדים)
 * - שולח ל-OpenAI עם System Prompt
 * - מזהה הוצאות אוטומטית
 * - שומר היסטוריה
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // אימות משתמש
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, phone } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 1. שליפת context של המשתמש
    const context = await fetchUserContext(supabase, user.id);

    // 2. שליפת 10 הודעות אחרונות (היסטוריה)
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // היסטוריה בסדר הפוך (ישן → חדש)
    const history = (recentMessages || []).reverse();

    // 3. בניית input ל-GPT-5-nano (Responses API)
    const systemContext = `${SYSTEM_PROMPT}\n\nהנה המידע על המשתמש:\n\n${buildContextMessage(context)}`;
    const historyText = history.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const fullInput = `${systemContext}\n\n${historyText}\n\nuser: ${message}`;

    // 4. 🆕 קריאה ל-GPT-5-nano with Responses API (fast chat)
    const chatResponse = await openai.responses.create({
      model: 'gpt-5-nano-2025-08-07',
      input: fullInput,
      reasoning: { effort: 'none' }, // Fast chat - no reasoning
      max_output_tokens: 1000,
    });

    const aiResponse = chatResponse.output_text || 'סליחה, לא הבנתי. תנסה שוב?';
    const tokensUsed = chatResponse.usage?.total_tokens || 0;

    // 5. זיהוי הוצאה (אם יש)
    const detectedExpense = parseExpenseFromAI(aiResponse);

    // 6. שמירת הודעת המשתמש
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: message,
      context_used: context,
    });

    // 7. שמירת תשובת ה-AI
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'assistant',
      content: aiResponse,
      tokens_used: tokensUsed,
      model: 'gpt-5-nano',
      detected_expense: detectedExpense,
      expense_created: false,
    });

    // 8. החזרת תשובה
    return NextResponse.json({
      success: true,
      response: aiResponse,
      detected_expense: detectedExpense,
      tokens_used: tokensUsed,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * שליפת context של המשתמש
 */
async function fetchUserContext(supabase: any, userId: string): Promise<UserContext> {
  const context: UserContext = {};

  // 1. פרופיל פיננסי
  const { data: profile } = await supabase
    .from('user_financial_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profile) {
    context.profile = {
      age: profile.age,
      monthlyIncome: profile.total_monthly_income,
      totalFixedExpenses: profile.total_fixed_expenses,
      availableBudget: (profile.total_monthly_income || 0) - (profile.total_fixed_expenses || 0),
      totalDebt: profile.total_debt,
      currentSavings: profile.current_savings,
    };
  }

  // 2. תקציב חודשי (אם קיים)
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const { data: budget } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single();

  if (budget) {
    const remaining = budget.total_budget - budget.total_spent;
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const daysRemaining = daysInMonth - currentDay;

    context.budget = {
      totalBudget: budget.total_budget,
      totalSpent: budget.total_spent,
      remaining,
      daysRemaining,
      status: budget.status,
    };
  }

  // 3. יעדים פעילים
  const { data: goals } = await supabase
    .from('goals')
    .select('name, target_amount, current_amount')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(5);

  if (goals && goals.length > 0) {
    context.goals = goals.map((goal: any) => ({
      name: goal.name,
      targetAmount: goal.target_amount,
      currentAmount: goal.current_amount || 0,
      progress: Math.round(((goal.current_amount || 0) / goal.target_amount) * 100),
    }));
  }

  // 4. 5 תנועות אחרונות
  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, vendor, amount, category')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .order('tx_date', { ascending: false })
    .limit(5);

  if (transactions && transactions.length > 0) {
    context.recentTransactions = transactions.map((tx: any) => ({
      date: new Date(tx.tx_date || tx.date).toLocaleDateString('he-IL'),
      description: tx.vendor || tx.category,
      amount: tx.amount,
      category: tx.category,
    }));
  }

  return context;
}

