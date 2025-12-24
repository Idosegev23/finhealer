/**
 * Chart Generator
 * 
 * Functions for generating financial charts using Gemini AI
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  generateChart,
  type ChartType,
  type GeneratedImage,
} from './gemini-image-client';

// ============================================================================
// Chart Generation
// ============================================================================

async function handleChartGeneration(
  chartType: string,
  userId: string,
  title?: string,
  description?: string
): Promise<GeneratedImage | null> {
  const supabase = createServiceClient();
  
  console.log(`[Chart Generator] Generating chart: ${chartType}`);
  
  const userData = await loadUserFinancialData(userId, supabase);
  
  if (!userData) {
    console.log('[Chart Generator] No financial data for chart');
    return null;
  }
  
  const prompt = buildDynamicChartPrompt(chartType, userData, title, description);
  
  return await generateChartWithGemini(prompt, `${chartType}_chart.png`);
}

async function loadUserFinancialData(
  userId: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, category, vendor, tx_date, status')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('tx_date', threeMonthsAgo.toISOString())
    .order('tx_date', { ascending: false });
    
  if (!transactions || transactions.length === 0) {
    return null;
  }
  
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);
    
  const categoryTotals: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cat = t.category || 'אחר';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
    });
    
  const monthlyData: Record<string, { income: number; expenses: number }> = {};
  transactions.forEach(t => {
    const month = new Date(t.tx_date).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    if (!monthlyData[month]) {
      monthlyData[month] = { income: 0, expenses: 0 };
    }
    if (t.type === 'income') {
      monthlyData[month].income += Number(t.amount);
    } else {
      monthlyData[month].expenses += Number(t.amount);
    }
  });
  
  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    categoryTotals,
    monthlyData,
    transactionCount: transactions.length,
  };
}

function buildDynamicChartPrompt(
  chartType: string,
  data: NonNullable<Awaited<ReturnType<typeof loadUserFinancialData>>>,
  title?: string,
  description?: string
): string {
  const formatMoney = (n: number) => n.toLocaleString('he-IL');
  
  const categoriesText = Object.entries(data.categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([cat, amount]) => `- ${cat}: ${formatMoney(amount)} ₪`)
    .join('\n');
    
  const monthlyText = Object.entries(data.monthlyData)
    .map(([month, d]) => `- ${month}: הכנסות ${formatMoney(d.income)} ₪, הוצאות ${formatMoney(d.expenses)} ₪`)
    .join('\n');
  
  return `צור אינפוגרפיקה/גרף בעברית עבור משתמש ישראלי.

🎨 *סגנון עיצוב:*
- מינימליסטי ומודרני
- צבעי מותג φ (Phi): זהב #A96B48, כהה #2E3440, רקע בהיר #ECEFF4
- כלול את סמל φ בפינה
- טקסט בעברית, RTL
- ברור וקריא

📊 *סוג הגרף:* ${chartType}
${title ? `📌 *כותרת:* ${title}` : ''}
${description ? `📝 *תיאור:* ${description}` : ''}

💰 *הנתונים:*
- סה"כ הכנסות: ${formatMoney(data.totalIncome)} ₪
- סה"כ הוצאות: ${formatMoney(data.totalExpenses)} ₪
- יתרה: ${formatMoney(data.balance)} ₪

📈 *התפלגות הוצאות:*
${categoriesText}

📅 *נתונים חודשיים:*
${monthlyText}

צור תמונה ויזואלית יפה שמציגה את הנתונים בצורה ברורה ומעוצבת.`;
}

async function generateChartWithGemini(
  prompt: string,
  filename: string
): Promise<GeneratedImage | null> {
  try {
    const result = await generateChart('pie', { 
      title: 'Dynamic Chart',
      categories: [],
      customPrompt: prompt 
    });
    
    if (result) {
      return {
        ...result,
        filename,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[Chart Generator] Error:', error);
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export async function generateChartForUser(
  userId: string,
  chartType: ChartType
): Promise<GeneratedImage | null> {
  return handleChartGeneration(chartType, userId);
}

export type { ChartType, GeneratedImage };

