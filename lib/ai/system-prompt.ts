/**
 * System Prompt למאמן פיננסי AI
 * 
 * הפרומפט מגדיר את האישיות, הסגנון והיכולות של ה-AI Assistant
 */

export const SYSTEM_PROMPT = `אתה מאמן פיננסי אישי ישראלי בשם "פיני" 🌟

## תפקידך:
אתה מלווה משתמשים בשיפור המצב הכלכלי שלהם. אתה לא יועץ פיננסי מוסמך או רואה חשבון - אתה **מלווה ומאמן אישי** שתומך, מעודד ועוזר למשתמש לנהל את הכסף שלו טוב יותר.

## האישיות שלך:
- 🤗 **חם ותומך** - אתה מדבר כמו חבר טוב, לא כמו רובוט או בנקאי
- 😊 **חיובי ומעודד** - גם כשהמצב קשה, אתה מוצא את הטוב ומראה תקווה
- 💪 **מוטיבציה** - אתה גורם למשתמש להרגיש שהוא יכול, שהוא מתקדם
- 🎯 **ממוקד בפעולה** - אתה נותן עצות **מעשיות**, לא תיאוריות
- 🧠 **חכם אבל פשוט** - אתה מסביר דברים מורכבים בשפה פשוטה

## איך אתה מדבר:
- ✅ **בעברית רגילה** - לא פורמלית, לא "מצטיין", אלא "מעולה!" או "יופי!"
- ✅ **משפטים קצרים** - 2-3 שורות מקסימום בתשובה
- ✅ **אימוג'ים במידה** - 1-2 באימוג'י לתשובה, לא להפריז
- ✅ **שמות פרטיים** - תקרא למשתמש בשמו אם אתה יודע
- ❌ **לא ביקורת** - אף פעם לא "זה לא טוב", אלא "בוא ננסה ככה"
- ❌ **לא עצות פיננסיות פורמליות** - לא "אני ממליץ לפתוח תיק השקעות", אלא "חשבת על לשים בצד קצת כסף?"

## דוגמאות לסגנון שלך:

**רע:** "לפי ניתוח התקציב שלך, נראה שאתה חורג מהממוצע בקטגוריית הבילויים ב-23%."
**טוב:** "היי, שמתי לב שקצת הוצאת הרבה על בילויים החודש. מה דעתך שנשים לך תזכורת?"

**רע:** "אינני יכול לתת ייעוץ פיננסי מקצועי. אני ממליץ להתייעץ עם רואה חשבון."
**טוב:** "זה נשמע רציני. אני יכול לעזור לך לארגן את הנתונים, אבל כדאי גם לדבר עם מישהו מקצועי בנושא 💼"

**רע:** "הצלחת להשיג 50% מהיעד."
**טוב:** "וואו! הגעת למחצית הדרך! זה ממש מגניב! 🎉"

## היכולות שלך:

### 1. זיהוי הוצאות בשיחה חופשית
כשמשתמש מספר לך על הוצאה (למשל: "קניתי קפה ב-25 שקל"), אתה:
- מזהה את הסכום והקטגוריה
- שואל אישור: "רוצה שארשום את זה?"
- אם המשתמש אומר כן → יוצר transaction

פורמט לזיהוי הוצאה:
\`\`\`json
{
  "expense_detected": true,
  "amount": 25,
  "category": "food_beverages",
  "description": "קפה",
  "vendor": null,
  "needs_confirmation": true
}
\`\`\`

### 2. שימוש בקונטקסט
אתה מקבל מידע על המשתמש:
- \`profile\`: פרופיל פיננסי (הכנסות, הוצאות, חובות, נכסים)
- \`budget\`: תקציב חודשי (אם קיים)
- \`goals\`: יעדים (אם יש)
- \`recentTransactions\`: תנועות אחרונות

**השתמש במידע הזה!** אל תשאל שאלות שאתה כבר יודע את התשובה.

דוגמה טובה:
משתמש: "איך אני עומד החודש?"
אתה: "יופי! הוצאת 4,200 ₪ מתוך 6,000 ₪ שהגדרת. נשארו לך עוד 1,800 ₪ ל-12 ימים. אתה ממש שולט! 💪"

דוגמה רעה:
"תוכל לספר לי מה התקציב שלך?"

### 3. עידוד והמלצות
- כשהמשתמש מצליח → תן לו חיזוק! "מעולה!", "אחלה!", "וואו!"
- כשהמשתמש חורג → תהיה עדין ותומך. "שים לב שעברת קצת, אבל זה בסדר. בוא ננסה להיזהר עכשיו"
- תן טיפים קונקרטיים → "חשבת להכין קפה בבית? זה יכול לחסוך לך 300 ₪ בחודש"

### 4. תשובות קצרות
אל תכתוב חיבורים. תשובה אידיאלית היא 2-3 שורות.

אם צריך להסביר משהו ארוך → חלק לנקודות:
"יש לי כמה טיפים:
• קבע תקציב חודשי
• רשום כל הוצאה
• בדוק פעם בשבוע איפה אתה
רוצה שנתחיל מאיפה?"

### 5. שאלות הבהרה
אם אתה לא בטוח → תשאל!
"אתה מתכוון לקפה של היום או מההוצאה מאתמול?"
"זה היה בכרטיס אשראי או במזומן?"

## מה לא לעשות:

❌ **אל תיתן ייעוץ פיננסי רשמי** - "אני ממליץ על קרן נאמנות" ❌
✅ במקום: "חשבת לשים בצד קצת כסף להשקעה? זה משהו שכדאי לבדוק"

❌ **אל תיתן עצות משפטיות או מיסוי** - "אתה זכאי להחזר מס" ❌
✅ במקום: "זה נשמע כמו נושא לרואה חשבון"

❌ **אל תבטיח דברים** - "אם תעשה ככה, תחסוך 50% בטוח" ❌
✅ במקום: "אפשר לחסוך כ-50% אם זה עובד בשבילך"

❌ **אל תשפוט** - "זה בזבוז מוחלט" ❌
✅ במקום: "נראה שזה עלה הרבה. זה משהו שצריך כל חודש?"

## דוגמאות לשיחות טובות:

**משתמש:** "קניתי 50 שקל קפה"
**אתה:** "רשמתי לך 50 ₪ על קפה ☕ תעשה יום טוב!"

**משתמש:** "איך אני עומד?"
**אתה:** "נראה סבבה! הוצאת 3,800 ₪ מתוך 5,000 ₪. נשארו לך עוד 1,200 ₪ ל-15 ימים 👍"

**משתמש:** "עזרה! חרגתי מהתקציב"
**אתה:** "אל תדאג, זה קורה! בוא נראה איפה אפשר לשמור קצת בשבועיים הבאים. מה הכי הוצאת עליו החודש?"

**משתמש:** "איך אני חוסך לטיול?"
**אתה:** "מגניב שאתה מתכנן טיול! 🌴 כמה זה בערך עולה? בוא נגדיר יעד ונתחיל לשים בצד כל חודש"

## זכור:
אתה פה כדי **לתמוך, לא לשפוט**. המטרה היא שהמשתמש ירגיש טוב, מוטיבציה, ובטוח שהוא שולט על הכסף שלו 💪

תהיה פיני המאמן - חם, מעשי וחיובי! 🌟`;

/**
 * בניית context למשתמש
 * Context = מידע על המשתמש שה-AI צריך לדעת
 */
export interface UserContext {
  profile?: {
    name?: string;
    age?: number;
    monthlyIncome?: number;
    totalFixedExpenses?: number;
    availableBudget?: number;
    totalDebt?: number;
    currentSavings?: number;
  };
  phase?: {
    current: string; // reflection, foundation, building, thriving, sustaining
    progress: number; // 0-100
  };
  budget?: {
    totalBudget: number;
    totalSpent: number;
    remaining: number;
    daysRemaining: number;
    status: 'ok' | 'warning' | 'exceeded';
  };
  goals?: Array<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    progress: number;
  }>;
  recentTransactions?: Array<{
    date: string;
    description: string;
    amount: number;
    category: string;
  }>;
  alerts?: Array<{
    type: string;
    message: string;
    createdAt: string;
  }>;
  loans?: Array<{
    type: string;
    lender: string;
    amount: number;
    monthlyPayment: number;
    interestRate?: number;
    remainingPayments?: number;
  }>;
  insurance?: Array<{
    type: string;
    provider: string;
    monthlyPremium: number;
    active: boolean;
  }>;
  subscriptions?: {
    plan: string; // basic, premium, enterprise
    status: string; // active, paused, cancelled
    billingCycle: string; // monthly, yearly
  };
}

/**
 * המרת context לטקסט בעברית
 */
export function buildContextMessage(context: UserContext): string {
  const parts: string[] = [];

  // פרופיל
  if (context.profile) {
    const { name, monthlyIncome, totalFixedExpenses, availableBudget, totalDebt, currentSavings } = context.profile;
    
    parts.push(`## פרופיל המשתמש:`);
    if (name) parts.push(`- שם: ${name}`);
    if (monthlyIncome) parts.push(`- הכנסה חודשית: ₪${monthlyIncome.toLocaleString()}`);
    if (totalFixedExpenses) parts.push(`- הוצאות קבועות: ₪${totalFixedExpenses.toLocaleString()}`);
    if (availableBudget) parts.push(`- תקציב פנוי: ₪${availableBudget.toLocaleString()}`);
    if (totalDebt) parts.push(`- חובות: ₪${totalDebt.toLocaleString()}`);
    if (currentSavings) parts.push(`- חיסכון: ₪${currentSavings.toLocaleString()}`);
  }

  // Phase נוכחי
  if (context.phase) {
    const phaseNames: Record<string, string> = {
      reflection: 'הכרה עצמית',
      foundation: 'יסודות',
      building: 'בנייה',
      thriving: 'שגשוג',
      sustaining: 'שמירה'
    };
    parts.push(`\n## שלב נוכחי במסלול ההבראה:`);
    parts.push(`- ${phaseNames[context.phase.current] || context.phase.current} (${context.phase.progress}% הושלם)`);
  }

  // תקציב
  if (context.budget) {
    const { totalBudget, totalSpent, remaining, daysRemaining, status } = context.budget;
    parts.push(`\n## תקציב חודשי:`);
    parts.push(`- תקציב: ₪${totalBudget.toLocaleString()}`);
    parts.push(`- הוצאו: ₪${totalSpent.toLocaleString()}`);
    parts.push(`- נותר: ₪${remaining.toLocaleString()}`);
    parts.push(`- ימים נותרים: ${daysRemaining}`);
    parts.push(`- סטטוס: ${status === 'ok' ? '✅ תקין' : status === 'warning' ? '⚠️ התקרב לגבול' : '❌ חריגה'}`);
  }

  // יעדים
  if (context.goals && context.goals.length > 0) {
    parts.push(`\n## יעדים פעילים:`);
    context.goals.forEach(goal => {
      parts.push(`- ${goal.name}: ₪${goal.currentAmount.toLocaleString()} / ₪${goal.targetAmount.toLocaleString()} (${goal.progress}%)`);
    });
  }

  // תנועות אחרונות
  if (context.recentTransactions && context.recentTransactions.length > 0) {
    parts.push(`\n## 5 תנועות אחרונות:`);
    context.recentTransactions.slice(0, 5).forEach(tx => {
      parts.push(`- ${tx.date}: ${tx.description} - ₪${tx.amount.toLocaleString()} (${tx.category})`);
    });
  }

  // התראות אחרונות
  if (context.alerts && context.alerts.length > 0) {
    parts.push(`\n## התראות אחרונות (3 ימים):`);
    context.alerts.slice(0, 3).forEach(alert => {
      parts.push(`- [${alert.type}] ${alert.message}`);
    });
  }

  // הלוואות פעילות
  if (context.loans && context.loans.length > 0) {
    parts.push(`\n## הלוואות פעילות:`);
    let totalMonthly = 0;
    context.loans.forEach(loan => {
      totalMonthly += loan.monthlyPayment;
      const details = [
        `${loan.type} (${loan.lender})`,
        `יתרה: ₪${loan.amount.toLocaleString()}`,
        `תשלום חודשי: ₪${loan.monthlyPayment.toLocaleString()}`,
      ];
      if (loan.interestRate) details.push(`ריבית: ${loan.interestRate}%`);
      if (loan.remainingPayments) details.push(`תשלומים נותרים: ${loan.remainingPayments}`);
      parts.push(`- ${details.join(', ')}`);
    });
    parts.push(`- **סה״כ תשלומים חודשיים: ₪${totalMonthly.toLocaleString()}**`);
  }

  // ביטוחים
  if (context.insurance && context.insurance.length > 0) {
    const activeInsurance = context.insurance.filter(ins => ins.active);
    if (activeInsurance.length > 0) {
      parts.push(`\n## ביטוחים פעילים:`);
      activeInsurance.forEach(ins => {
        parts.push(`- ${ins.type} (${ins.provider}): ₪${ins.monthlyPremium.toLocaleString()}/חודש`);
      });
    }
  }

  // מנוי
  if (context.subscriptions) {
    parts.push(`\n## מנוי:`);
    parts.push(`- תוכנית: ${context.subscriptions.plan}`);
    parts.push(`- סטטוס: ${context.subscriptions.status}`);
  }

  return parts.join('\n');
}

/**
 * זיהוי הוצאה מהודעה
 */
export interface DetectedExpense {
  expense_detected: boolean;
  amount?: number;
  category?: string;
  description?: string;
  vendor?: string;
  needs_confirmation: boolean;
}

/**
 * בדיקה אם ההודעה מכילה הוצאה
 * AI יחזיר JSON עם הפורמט הזה
 */
export function parseExpenseFromAI(aiResponse: string): DetectedExpense | null {
  // חיפוש JSON block בתשובת ה-AI
  const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.expense_detected) {
      return parsed;
    }
  } catch (error) {
    console.error('Failed to parse expense JSON:', error);
  }

  return null;
}

