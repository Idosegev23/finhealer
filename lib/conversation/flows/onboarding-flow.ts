/**
 * Onboarding Flow - WhatsApp-First
 * 
 * שיחה ידידותית, חמה ומסבירה!
 * כל שאלה מגיעה עם הסבר למה היא חשובה.
 * 
 * עקרון מפתח:
 * ❌ לא: שאלות יבשות וקצרות
 * ✅ כן: שיחה חמה שמסבירה ומעודדת
 * 
 * 🆕 שימוש ב-AI לפרסור חכם של תשובות!
 */

import { createClient } from '@/lib/supabase/server';
import { chatWithGPT5Fast } from '@/lib/ai/gpt5-client';

// ============================================================================
// AI-Powered Parser - פרסור חכם עם AI
// ============================================================================

interface ParsedOnboardingData {
  age?: number;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  children_count?: number;
  employment_status?: 'employee' | 'self_employed' | 'both';
  name?: string;
}

/**
 * 🆕 פרסור חכם עם AI - מבין כל צורת תשובה!
 * 
 * דוגמאות:
 * - "בן 39 נשוי פלוס 3" → { age: 39, marital_status: 'married', children_count: 3 }
 * - "אני בת 28, רווקה" → { age: 28, marital_status: 'single' }
 * - "45 גרוש עם שני ילדים" → { age: 45, marital_status: 'divorced', children_count: 2 }
 */
async function parseOnboardingWithAI(
  message: string, 
  currentContext: { waitingFor: string; existingData: Partial<ParsedOnboardingData> }
): Promise<ParsedOnboardingData> {
  const systemPrompt = `אתה מפרסר תשובות של משתמש ישראלי בתהליך אונבורדינג פיננסי.

המשתמש יכול לענות בכל צורה - המשימה שלך לחלץ את המידע.

חלץ רק את השדות הרלוונטיים מהתשובה:
- age: גיל (מספר בין 18-120)
- marital_status: מצב משפחתי (single/married/divorced/widowed)
- children_count: מספר ילדים (0-15)
- employment_status: תעסוקה (employee/self_employed/both)
- name: שם מלא (אם נאמר)

מיפוי מצב משפחתי:
- רווק/רווקה/סינגל → single
- נשוי/נשואה/נשואים → married  
- גרוש/גרושה → divorced
- אלמן/אלמנה → widowed

מיפוי תעסוקה:
- שכיר/עובד/employee → employee
- עצמאי/פרילנסר/עסק → self_employed
- משולב/גם וגם/שניהם → both

מיפוי ילדים:
- "פלוס 3" / "עם 3" / "ועוד 3" / "3 ילדים" / "שלושה" → 3
- "אין ילדים" / "בלי" / "0" → 0

החזר JSON בלבד, ללא טקסט נוסף.
אם לא הצלחת לזהות שדה - אל תכלול אותו.

דוגמאות:
"בן 39 נשוי פלוס 3" → {"age":39,"marital_status":"married","children_count":3}
"אני בת 28 רווקה" → {"age":28,"marital_status":"single"}
"גרוש, שני ילדים, עצמאי" → {"marital_status":"divorced","children_count":2,"employment_status":"self_employed"}
"45" → {"age":45}
"עצמאי" → {"employment_status":"self_employed"}`;

  const userPrompt = `הקונטקסט: ממתין ל-${currentContext.waitingFor}
נתונים קיימים: ${JSON.stringify(currentContext.existingData)}

תשובת המשתמש: "${message}"

חלץ את המידע והחזר JSON:`;

  try {
    const response = await chatWithGPT5Fast(
      userPrompt,
      systemPrompt,
      { userId: 'system', userName: 'Parser', phoneNumber: '' }
    );
    
    // נקה את התשובה מכל טקסט שאינו JSON
    const jsonMatch = response.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[AI Parser] Parsed:', parsed);
      return parsed;
    }
    
    return {};
  } catch (error) {
    console.error('[AI Parser] Error:', error);
    // fallback לפרסור רגיל אם AI נכשל
    return fallbackParse(message);
  }
}

/**
 * Fallback parser - אם AI לא זמין
 */
function fallbackParse(message: string): ParsedOnboardingData {
  const result: ParsedOnboardingData = {};
  const lower = message.toLowerCase();
  
  // גיל
  const ageMatch = message.match(/\d+/);
  if (ageMatch) {
    const age = parseInt(ageMatch[0]);
    if (age >= 18 && age <= 120) result.age = age;
  }
  
  // מצב משפחתי
  if (lower.includes('רווק') || lower.includes('single')) result.marital_status = 'single';
  else if (lower.includes('נשוי') || lower.includes('נשואה')) result.marital_status = 'married';
  else if (lower.includes('גרוש') || lower.includes('גרושה')) result.marital_status = 'divorced';
  else if (lower.includes('אלמן') || lower.includes('אלמנה')) result.marital_status = 'widowed';
  
  // ילדים
  const childMatch = lower.match(/(פלוס|עם|\+|ועוד)\s*(\d+)/);
  if (childMatch) result.children_count = parseInt(childMatch[2]);
  
  // תעסוקה
  if (lower.includes('משולב') || lower.includes('גם וגם')) result.employment_status = 'both';
  else if (lower.includes('שכיר') || lower.includes('עובד')) result.employment_status = 'employee';
  else if (lower.includes('עצמאי') || lower.includes('פרילנס')) result.employment_status = 'self_employed';
  
  return result;
}

interface OnboardingContext {
  userId: string;
  currentStep: 'personal' | 'documents' | 'complete';
  collectedData: {
    // Personal
    full_name?: string;
    age?: number;
    marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
    children_count?: number;
    children_ages?: number[];
    city?: string;
    employment_status?: 'employee' | 'self_employed' | 'both';
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleOnboardingFlow(
  context: OnboardingContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean }> {
  switch (context.currentStep) {
    case 'personal':
      return await handleOnboardingPersonal(context, message);
    case 'documents':
      return await handleOnboardingDocuments(context, message);
    default:
      return {
        response: getWelcomeMessage(),
        nextStep: 'personal',
        completed: false,
      };
  }
}

// ============================================================================
// הודעת פתיחה
// ============================================================================

function getWelcomeMessage(): string {
  return `היי! 👋

אני φ (פאי) - המאמן הפיננסי האישי שלך, ואני ממש שמח שבחרת להתחיל את המסע הזה!

🎯 המטרה שלי פשוטה: לעזור לך להרגיש שליטה מלאה על הכסף שלך, בלי לחץ ובלי שיפוטיות.

בוא נתחיל בהיכרות קצרצרה - מה השם שלך? 😊`;
}

// ============================================================================
// שלב 1: מידע אישי - שיחה ידידותית!
// ============================================================================

export async function handleOnboardingPersonal(
  context: OnboardingContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean }> {
  const data = context.collectedData;

  // שלב 1.1: שם - אם אין שם, ה-message הנוכחי הוא השם!
  if (!data.full_name) {
    // המשתמש שלח את השם שלו - שמור אותו והמשך לשאלה הבאה
    const name = message.trim();
    
    // בדיקה בסיסית שזה שם ולא הודעה אחרת
    if (name.length < 2 || name.length > 50) {
      return {
        response: `לא הבנתי 🤔
        
אנא כתוב את השם שלך (שם פרטי ומשפחה, או רק שם פרטי)`,
        nextStep: 'collect_name',
        completed: false,
      };
    }
    
    data.full_name = name;
    return {
      response: `נעים מאוד ${data.full_name}! 🤝

עכשיו ספר לי קצת על עצמך -
גיל, מצב משפחתי, ואם יש ילדים.

💡 אתה יכול לכתוב הכל במשפט אחד, למשל:
"בן 35, נשוי, 2 ילדים"
או לענות בנפרד - מה שנוח לך!

אז... ספר לי 😊`,
      nextStep: 'collect_personal_info',
      completed: false,
    };
  }
  
  // 🆕 שלב 1.2: פרסור חכם עם AI - מבין כל תשובה!
  // המשתמש יכול לכתוב "בן 39 נשוי פלוס 3" או לענות בנפרד
  
  // בדוק מה עדיין חסר
  const missingFields: string[] = [];
  if (!data.age) missingFields.push('age');
  if (!data.marital_status) missingFields.push('marital_status');
  if (data.children_count === undefined && data.marital_status && data.marital_status !== 'single') {
    missingFields.push('children_count');
  }
  if (!data.employment_status) missingFields.push('employment_status');
  
  // 🆕 שלח ל-AI לפרסר
  const parsed = await parseOnboardingWithAI(message, {
    waitingFor: missingFields.join(', ') || 'any',
    existingData: {
      age: data.age,
      marital_status: data.marital_status,
      children_count: data.children_count,
      employment_status: data.employment_status,
    }
  });
  
  // עדכן את הנתונים
  if (parsed.age) data.age = parsed.age;
  if (parsed.marital_status) data.marital_status = parsed.marital_status;
  if (parsed.children_count !== undefined) data.children_count = parsed.children_count;
  if (parsed.employment_status) data.employment_status = parsed.employment_status;
  
  // אם יש מצב משפחתי "רווק" - אין ילדים (בד"כ)
  if (data.marital_status === 'single' && data.children_count === undefined) {
    data.children_count = 0;
  }
  
  // בדוק מה עדיין חסר אחרי הפרסור
  const stillMissing: string[] = [];
  if (!data.age) stillMissing.push('גיל');
  if (!data.marital_status) stillMissing.push('מצב משפחתי');
  if (data.children_count === undefined && data.marital_status && data.marital_status !== 'single') {
    stillMissing.push('מספר ילדים');
  }
  if (!data.employment_status) stillMissing.push('סוג תעסוקה');
  
  // אם חסר משהו - שאל
  if (stillMissing.length > 0) {
    // בנה תגובה מותאמת
    let response = '';
    let gotSomething = parsed.age || parsed.marital_status || parsed.children_count !== undefined || parsed.employment_status;
    
    if (gotSomething) {
      response = 'תפסתי! ✅\n\n';
      if (parsed.age) response += `• גיל: ${parsed.age}\n`;
      if (parsed.marital_status) response += `• מצב משפחתי: ${formatMaritalStatus(parsed.marital_status)}\n`;
      if (parsed.children_count !== undefined) response += `• ילדים: ${parsed.children_count}\n`;
      if (parsed.employment_status) response += `• תעסוקה: ${formatEmployment(parsed.employment_status)}\n`;
      response += '\n';
    }
    
    // שאל על מה שחסר
    if (stillMissing.includes('גיל')) {
      response += 'בן/בת כמה אתה?';
    } else if (stillMissing.includes('מצב משפחתי')) {
      response += 'מה המצב המשפחתי שלך? (רווק/נשוי/גרוש/אלמן)';
    } else if (stillMissing.includes('מספר ילדים')) {
      response += 'כמה ילדים יש לכם? (מספר או "אין")';
    } else if (stillMissing.includes('סוג תעסוקה')) {
      response += 'מה סוג התעסוקה שלך?\n• שכיר\n• עצמאי\n• משולב (גם וגם)';
    }
    
    return {
      response,
      nextStep: 'collect_personal_info',
      completed: false,
    };
  }
  
  // 🎉 יש את כל המידע! עבור לשלב הבא
  await savePersonalInfo(context.userId, data);
  
  const summary = `מעולה ${data.full_name}! יש לי את כל מה שצריך 🎉

📋 סיכום:
• גיל: ${data.age}
• מצב משפחתי: ${formatMaritalStatus(data.marital_status!)}
${data.children_count && data.children_count > 0 ? `• ילדים: ${data.children_count}\n` : ''}• תעסוקה: ${formatEmployment(data.employment_status!)}

עכשיו מגיע החלק המעניין! 📊

כדי שאוכל לתת לך תמונה מדויקת של המצב הפיננסי שלך,
אני צריך לראות את התנועות בחשבון הבנק.

📄 מה צריך?
דוח בנק של 3 החודשים האחרונים

🔒 למה זה בטוח?
• אני לא שומר את הקובץ
• אני רק קורא את התנועות
• המידע שלך מוצפן ומאובטח

📱 איך שולחים?
פשוט שלח לי את הקובץ פה בWhatsApp!
(PDF, תמונה, או צילום מסך - מה שנוח לך)

מוכן? שלח לי את הדוח! 🚀`;

  return {
    response: summary,
    nextStep: 'collect_documents',
    completed: false,
  };
}

// Helper functions for formatting
function formatMaritalStatus(status: string): string {
  const map: Record<string, string> = {
    single: 'רווק/ה',
    married: 'נשוי/אה',
    divorced: 'גרוש/ה',
    widowed: 'אלמן/ה',
  };
  return map[status] || status;
}

function formatEmployment(status: string): string {
  const map: Record<string, string> = {
    employee: 'שכיר',
    self_employed: 'עצמאי',
    both: 'משולב',
  };
  return map[status] || status;
}

// ============================================================================
// Legacy handlers (kept for backwards compatibility)
// ============================================================================

async function handleOnboardingPersonalLegacy(
  context: OnboardingContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean }> {
  const data = context.collectedData;

  // שלב 1.2: גיל
  // 🆕 פרסור חכם - המשתמש יכול לכתוב "בן 39 נשוי פלוס 3" בהודעה אחת!
  if (!data.age) {
    const age = extractAge(message);
    if (age && age > 0 && age < 120) {
      data.age = age;
      
      // 🆕 בדוק אם יש גם מצב משפחתי באותה הודעה
      const marital = extractMaritalStatus(message);
      if (marital) {
        data.marital_status = marital;
        
        // 🆕 בדוק אם יש גם ילדים באותה הודעה
        const children = extractChildrenFromMessage(message);
        if (children !== null) {
          data.children_count = children;
          
          // יש גיל + מצב משפחתי + ילדים - דלג לתעסוקה!
          const childText = children > 0 
            ? `${children} ילדים - וואו, יש לכם את הידיים מלאות! 👨‍👩‍👧‍👦` 
            : '';
          
          return {
            response: `תפסתי הכל! ${age}, ${marital === 'married' ? 'נשוי/אה' : marital === 'divorced' ? 'גרוש/ה' : 'אלמן/ה'}${children > 0 ? `, ${childText}` : ''} ✅

עוד שאלה אחרונה! 💼

מה סוג התעסוקה שלך?
• שכיר
• עצמאי  
• משולב (גם וגם)`,
            nextStep: 'collect_employment',
            completed: false,
          };
        }
        
        // יש גיל + מצב משפחתי, אין ילדים - שאל על ילדים
        if (marital === 'single') {
          data.children_count = 0;
          return {
            response: `תפסתי! ${age}, רווק/ה ✅

עוד שאלה אחרונה! 💼

מה סוג התעסוקה שלך?
• שכיר
• עצמאי
• משולב (גם וגם)`,
            nextStep: 'collect_employment',
            completed: false,
          };
        }
        
        return {
          response: `תפסתי! ${age}, ${marital === 'married' ? 'נשוי/אה' : marital === 'divorced' ? 'גרוש/ה' : 'אלמן/ה'} ✅

יש לכם ילדים? כמה?
(פשוט מספר, או "אין")`,
          nextStep: 'collect_children',
          completed: false,
        };
      }
      
      // רק גיל - שאל על מצב משפחתי
      return {
        response: `מעולה! ${age} - גיל מצוין ${age < 30 ? 'להתחיל לבנות הרגלים פיננסיים טובים' : age < 50 ? 'לקחת שליטה על הכסף' : 'לתכנן לטווח ארוך'}! 💪

עכשיו, ספר לי קצת על המצב המשפחתי שלך -
זה חשוב כי הוצאות משפחה משפיעות מאוד על התקציב.

אתה רווק/ה, נשוי/אה, גרוש/ה...?`,
        nextStep: 'collect_marital_status',
        completed: false,
      };
    } else {
      return {
        response: `אופס, לא הבנתי 😅

פשוט כתוב לי מספר - בן/בת כמה אתה?
(לדוגמה: 35)`,
        nextStep: 'collect_age',
        completed: false,
      };
    }
  }

  // שלב 1.3: מצב משפחתי
  if (!data.marital_status) {
    const marital = extractMaritalStatus(message);
    if (marital) {
      data.marital_status = marital;
      
      if (marital === 'single') {
        data.children_count = 0;
        // דלג לשאלת תעסוקה
        return {
          response: `סבבה! 😊

עוד שאלה אחת קצרה לפני שנצלול לנתונים -
מה סוג התעסוקה שלך?

אתה שכיר, עצמאי, או משולב (גם וגם)?

💡 זה חשוב כי הכנסה של שכיר יציבה יותר, 
בעוד עצמאי צריך לתכנן אחרת...`,
          nextStep: 'collect_employment',
          completed: false,
        };
      } else {
        // 🆕 בדוק אם המשתמש כבר ציין מספר ילדים באותה הודעה
        // לדוגמה: "נשוי עם 3 ילדים" או "נשוי, 2 ילדים"
        const childrenInMessage = extractChildrenFromMessage(message);
        if (childrenInMessage !== null) {
          data.children_count = childrenInMessage;
          const childText = childrenInMessage > 0 
            ? `${childrenInMessage} ילדים - וואו, יש לכם את הידיים מלאות! 👨‍👩‍👧‍👦` 
            : 'הבנתי!';
          
          return {
            response: `${childText}

עוד שאלה אחרונה לפני שנתחיל ברצינות! 💼

מה סוג התעסוקה שלך?
• שכיר
• עצמאי
• משולב (גם וגם)

💡 זה משפיע על איך נתכנן את התקציב והחיסכון שלך.`,
            nextStep: 'collect_employment',
            completed: false,
          };
        }
        
        return {
          response: `אחלה! 🙌

ספר לי - יש לכם ילדים?

(ילדים משפיעים משמעותית על התקציב - חינוך, ביגוד, חוגים...
אני רוצה להתחשב בזה בתכנון שלנו)`,
          nextStep: 'collect_children',
          completed: false,
        };
      }
    } else {
      return {
        response: `לא הבנתי 🤔

פשוט כתוב לי:
• רווק/ה
• נשוי/אה
• גרוש/ה
• אלמן/ה`,
        nextStep: 'collect_marital_status',
        completed: false,
      };
    }
  }

  // שלב 1.4: ילדים - שאלה האם יש ילדים + כמה
  if (data.children_count === undefined) {
    // קודם כל בדוק אם זו תשובה כן/לא
    if (isPositiveAnswer(message)) {
      return {
        response: `כמה ילדים יש לכם? 👶

(פשוט מספר - לדוגמה: 2)`,
        nextStep: 'collect_children_count',
        completed: false,
      };
    } else if (isNegativeAnswer(message)) {
      data.children_count = 0;
      // אם אין ילדים, עבור לשאלת תעסוקה
      return {
        response: `הבנתי! 😊

עוד שאלה אחרונה לפני שנתחיל ברצינות! 💼

מה סוג התעסוקה שלך?
• שכיר
• עצמאי
• משולב (גם וגם)

💡 זה משפיע על איך נתכנן את התקציב והחיסכון שלך.`,
        nextStep: 'collect_employment',
        completed: false,
      };
    } else {
      // בדוק אם זה מספר (כמה ילדים)
      const count = extractNumber(message);
      if (count !== null && count >= 0 && count < 20) {
        data.children_count = count;
        const childText = count > 0 
          ? `${count} ילדים - וואו, יש לכם את הידיים מלאות! 👨‍👩‍👧‍👦` 
          : 'הבנתי!';
        
        return {
          response: `${childText}

עוד שאלה אחרונה לפני שנתחיל ברצינות! 💼

מה סוג התעסוקה שלך?
• שכיר
• עצמאי
• משולב (גם וגם)

💡 זה משפיע על איך נתכנן את התקציב והחיסכון שלך.`,
          nextStep: 'collect_employment',
          completed: false,
        };
      } else {
        return {
          response: `לא הבנתי 😅

יש לכם ילדים? (כן/לא)
או כתוב כמה ילדים יש לכם (מספר)`,
          nextStep: 'collect_children',
          completed: false,
        };
      }
    }
  }

  // שלב 1.5: סטטוס תעסוקה - סיום שלב Personal
  if (!data.employment_status) {
    const employment = extractEmploymentStatus(message);
    if (employment) {
      data.employment_status = employment;
      
      // שמירה לדאטהבייס
      await savePersonalInfo(context.userId, data);
      
      const employmentText = employment === 'employee' 
        ? 'שכיר - יציבות זה טוב!' 
        : employment === 'self_employed' 
        ? 'עצמאי - חופש עם אחריות!' 
        : 'משולב - הכי טוב משני העולמות!';
      
      return {
        response: `${employmentText} 👍

מעולה ${data.full_name}! סיימנו את ההיכרות 🎉

עכשיו מגיע החלק המעניין! 📊

כדי שאוכל לתת לך תמונה מדויקת של המצב הפיננסי שלך,
אני צריך לראות את התנועות בחשבון הבנק שלך.

📄 מה צריך?
דוח בנק של 3 החודשים האחרונים

🔒 למה זה בטוח?
• אני לא שומר את הקובץ
• אני רק קורא את התנועות
• המידע שלך מוצפן ומאובטח

📱 איך שולחים?
פשוט שלח לי את הקובץ פה בWhatsApp!
(PDF, תמונה, או צילום מסך - מה שנוח לך)

מוכן? שלח לי את הדוח! 🚀`,
        nextStep: 'documents',
        completed: true,
      };
    } else {
      return {
        response: `לא הבנתי 🤔

מה סוג התעסוקה שלך?
• שכיר - עובד עם משכורת קבועה
• עצמאי - עסק עצמאי או פרילנסר
• משולב - גם וגם`,
        nextStep: 'collect_employment',
        completed: false,
      };
    }
  }

  // אם הגענו לכאן, משהו לא בסדר - החזר להתחלה
  return {
    response: `משהו השתבש 😕

בוא נתחיל מחדש - מה השם שלך?`,
    nextStep: 'collect_name',
    completed: false,
  };
}

// ============================================================================
// שלב 2: בקשת דוחות - עם הסברים ותמיכה!
// ============================================================================

export async function handleOnboardingDocuments(
  context: OnboardingContext,
  message: string
): Promise<{ response: string; nextStep: string; completed: boolean }> {
  const lowerMessage = message.toLowerCase();
  
  // עזרה - איך להוריד דוח
  if (lowerMessage.includes('איך') || lowerMessage.includes('מאיפה') || lowerMessage.includes('לא מצליח') || lowerMessage.includes('עזרה')) {
    return {
      response: `בשמחה אעזור! 😊

📱 הנה איך להוריד דוח בנק:

1️⃣ פתח את האפליקציה של הבנק שלך

2️⃣ חפש "תנועות" או "דוחות" או "פעולות אחרונות"

3️⃣ בחר טווח תאריכים: 3 חודשים אחרונים

4️⃣ חפש כפתור "ייצוא" או "שיתוף" או "PDF"

5️⃣ שלח לי את הקובץ פה בWhatsApp 📤

🏦 באיזה בנק אתה?
אם תגיד לי, אוכל לתת הוראות יותר ספציפיות!`,
      nextStep: 'documents',
      completed: false,
    };
  }

  // לא רוצה / אחר כך
  if (lowerMessage.includes('לא רוצה') || lowerMessage.includes('אחר כך') || lowerMessage.includes('מאוחר') || lowerMessage.includes('לא עכשיו')) {
    return {
      response: `בסדר גמור! אין לחץ 😊

אני מבין שזה דורש קצת זמן ואמון.

כשתהיה מוכן - פשוט שלח לי את הדוח, ואני אתחיל לעבוד!

💡 אגב, אם יש לך שאלות על האבטחה או מה אני עושה עם המידע - 
אשמח להסביר!

אזכיר לך מחר בבוקר, בסדר? 🌅`,
      nextStep: 'documents',
      completed: false,
    };
  }

  // שאלות על אבטחה
  if (lowerMessage.includes('בטוח') || lowerMessage.includes('אבטחה') || lowerMessage.includes('פרטיות') || lowerMessage.includes('מאובטח')) {
    return {
      response: `שאלה מצוינת! אני שמח שאתה שואל 🔒

הנה מה שחשוב לדעת:

✅ אני לא שומר את קובץ הדוח
• אני רק קורא את התנועות ומוחק את הקובץ

✅ המידע שלך מוצפן
• כל הנתונים מאוחסנים בצורה מאובטחת

✅ רק אתה רואה את הנתונים שלך
• אף אחד אחר לא יכול לגשת למידע

✅ אתה יכול למחוק הכל בכל רגע
• דרך ההגדרות באתר

יש לך עוד שאלות? אשמח לענות! 💬`,
      nextStep: 'documents',
      completed: false,
    };
  }

  // ציון בנק ספציפי
  const banks = ['לאומי', 'פועלים', 'דיסקונט', 'מזרחי', 'הבינלאומי', 'יהב', 'מרכנתיל'];
  const mentionedBank = banks.find(bank => lowerMessage.includes(bank));
  
  if (mentionedBank) {
    return {
      response: `בנק ${mentionedBank}! מכיר 🏦

הנה איך להוריד דוח מבנק ${mentionedBank}:

1️⃣ פתח את האפליקציה של בנק ${mentionedBank}

2️⃣ היכנס לחשבון שלך

3️⃣ לחץ על "תנועות" או "פירוט חשבון"

4️⃣ בחר "3 חודשים אחרונים"

5️⃣ לחץ על אייקון השיתוף/ייצוא (בדרך כלל למעלה)

6️⃣ בחר "PDF" או "שתף"

7️⃣ שלח לי פה בWhatsApp! 📤

נתקע? ספר לי באיזה שלב ואעזור! 💪`,
      nextStep: 'documents',
      completed: false,
    };
  }
  
  // הודעת ברירת מחדל - מחכה לקובץ
  return {
    response: `אני מחכה לדוח הבנק שלך! 📄

תזכורת קצרה:
• PDF, תמונה, או צילום מסך
• 3 חודשים אחרונים
• פשוט שלח פה בWhatsApp

🆘 צריך עזרה? כתוב לי "איך להוריד" ואסביר!
🔒 שאלות על אבטחה? כתוב "האם זה בטוח"

אני פה בשבילך! 😊`,
    nextStep: 'documents',
    completed: false,
  };
}

// ============================================================================
// הודעות מיוחדות - חמות ומסבירות!
// ============================================================================

/**
 * הודעה שנשלחת אחרי שהמשתמש העלה דוח בהצלחה
 */
export function getDocumentReceivedMessage(): string {
  return `קיבלתי את הדוח! 📄✅

⏳ אני מנתח עכשיו את התנועות...

זה לוקח כמה שניות - אני עובר על כל תנועה ומנסה להבין:
• מה סוג ההוצאה/הכנסה
• לאיזה קטגוריה זה שייך
• האם יש דפוסים מעניינים

רגע אחד... 🔍`;
}

/**
 * הודעה אחרי עיבוד מוצלח של דוח
 */
export function getDocumentProcessedMessage(transactionCount: number): string {
  if (transactionCount === 0) {
    return `הממ... לא מצאתי תנועות בדוח 🤔

זה יכול לקרות אם:
• הדוח ריק
• הפורמט לא מוכר לי
• התמונה לא ברורה

בוא ננסה שוב? 
שלח לי דוח אחר או תמונה יותר ברורה 📸`;
  }
  
  if (transactionCount < 10) {
    return `מצאתי ${transactionCount} תנועות! 📊

זה קצת מעט... האם זה הדוח של 3 חודשים?
אם יש לך דוח יותר מקיף, זה יעזור לי לתת לך תמונה מדויקת יותר.

בכל מקרה, בוא נתחיל! 💪
יש לי כמה שאלות קצרות על חלק מהתנועות.

מוכן?`;
  }
  
  return `וואו! מצאתי ${transactionCount} תנועות! 📊

עבודה יפה! עכשיו אני מבין הרבה יותר טוב את התמונה הפיננסית שלך.

✅ רוב התנועות אני מזהה אוטומטית
❓ יש לי כמה שאלות על תנועות שאני לא בטוח לגביהן

זה יקח כמה דקות, אבל ככה נוכל לקטלג הכל נכון.

בא לך לעבור על זה עכשיו? 
(אם לא עכשיו - אפשר אחר כך, אין בעיה!)`;
}

/**
 * בקשה לדוח נוסף (אשראי)
 */
export function getCreditStatementRequest(amount: number, date: string): string {
  return `שמתי לב למשהו מעניין! 💳

ב-${date} יש חיוב אשראי של ${formatCurrency(amount)}.

זה בדרך כלל סכום של הרבה קניות קטנות יחד.
כדי שאוכל לפרט את זה לקטגוריות (מזון, בילויים, קניות...) - 
אני צריך את דוח פירוט כרטיס האשראי.

📄 יש לך את הדוח הזה?
(בדרך כלל אפשר להוריד מהאפליקציה של חברת האשראי - ויזה, מסטרקארד, ישראכרט...)

אם אין לך עכשיו - אפשר להמשיך בלי זה ולהוסיף אחר כך! 😊`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractAge(text: string): number | null {
  const match = text.match(/\d+/);
  if (match) {
    const age = parseInt(match[0]);
    if (age > 0 && age < 120) return age;
  }
  return null;
}

function extractMaritalStatus(text: string): 'single' | 'married' | 'divorced' | 'widowed' | null {
  const lower = text.toLowerCase();
  if (lower.includes('רווק') || lower.includes('single')) return 'single';
  if (lower.includes('נשוי') || lower.includes('married') || lower.includes('נשואה')) return 'married';
  if (lower.includes('גרוש') || lower.includes('divorced') || lower.includes('גרושה')) return 'divorced';
  if (lower.includes('אלמן') || lower.includes('widowed') || lower.includes('אלמנה')) return 'widowed';
  return null;
}

function extractEmploymentStatus(text: string): 'employee' | 'self_employed' | 'both' | null {
  const lower = text.toLowerCase();
  if (lower.includes('משולב') || lower.includes('שניהם') || lower.includes('both') || lower.includes('גם וגם')) return 'both';
  if (lower.includes('שכיר') || lower.includes('employee') || lower.includes('עובד')) return 'employee';
  if (lower.includes('עצמאי') || lower.includes('self') || lower.includes('עסק') || lower.includes('פרילנס')) return 'self_employed';
  return null;
}

function extractNumber(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

/**
 * 🆕 חילוץ מספר ילדים מהודעה מורכבת
 * לדוגמה: "נשוי עם 3 ילדים", "נשואה, 2 ילדים", "גרוש + 1 ילד", "נשוי פלוס 3"
 */
function extractChildrenFromMessage(text: string): number | null {
  const lower = text.toLowerCase();
  
  // חפש דפוסים כמו "X ילדים" או "X ילד"
  const childrenMatch = lower.match(/(\d+)\s*(ילדים|ילד|children|kids|child)/);
  if (childrenMatch) {
    return parseInt(childrenMatch[1]);
  }
  
  // חפש דפוסים כמו "עם X" או "+ X" או "פלוס X" או "ועוד X"
  const withMatch = lower.match(/(עם|עימ|\+|פלוס|ועוד|plus)\s*(\d+)/);
  if (withMatch) {
    return parseInt(withMatch[2]);
  }
  
  // אם יש מצב משפחתי (לא רווק) ויש מספר אחרי הגיל הראשון
  // לדוגמה: "39 נשוי 3" - המספר השני הוא ילדים
  if (lower.includes('נשוי') || lower.includes('נשואה') || lower.includes('גרוש')) {
    const numbers = lower.match(/\d+/g);
    if (numbers && numbers.length >= 2) {
      const secondNum = parseInt(numbers[1]);
      // אם המספר השני קטן מ-10, זה כנראה ילדים
      if (secondNum > 0 && secondNum < 10) {
        return secondNum;
      }
    }
  }
  
  return null;
}

function isPositiveAnswer(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('כן') || lower.includes('yes') || lower.includes('יש') || lower.includes('בטח') || lower === 'כ';
}

function isNegativeAnswer(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('לא') || lower.includes('no') || lower.includes('אין') || lower === '0';
}

function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString('he-IL')}`;
}

// ============================================================================
// Database Operations
// ============================================================================

async function savePersonalInfo(userId: string, data: any): Promise<void> {
  const supabase = await createClient();
  
  // Update users table
  await supabase
    .from('users')
    .update({
      full_name: data.full_name,
      age: data.age,
      marital_status: data.marital_status,
      employment_status: data.employment_status,
      phase: 'data_collection',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // Update user_financial_profile
  await supabase
    .from('user_financial_profile')
    .upsert({
      user_id: userId,
      age: data.age,
      marital_status: data.marital_status,
      children_count: data.children_count || 0,
      children_ages: data.children_ages || [],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id'
    });
}

// ============================================================================
// Aliases for orchestrator compatibility
// ============================================================================

export const handleOnboardingIncome = handleOnboardingDocuments;
export const handleOnboardingExpenses = handleOnboardingDocuments;
