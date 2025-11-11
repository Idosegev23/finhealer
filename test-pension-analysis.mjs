import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzePensionReport(filePath, reportType) {
  const startTime = Date.now();
  
  try {
    console.log(`🏦 Starting GPT-5 pension report analysis (${reportType})...\n`);
    
    const text = fs.readFileSync(filePath, 'utf-8');
    console.log(`📄 Text length: ${text.length} characters\n`);
    
    const analysisStart = Date.now();
    
    const prompt = `אתה מומחה בניתוח דוחות מסלקה פנסיונית ישראלית.

נתח את דוח המסלקה הבא וחלץ את **כל התוכניות והנתונים הפנסיוניים**.

## **מה לחלץ:**

### **1. מידע כללי (report_info):**
- שם הלקוח (customer_name)
- תעודת זהות (id_number)
- תאריך דוח (report_date)
- שם סוכן/יועץ (agent_name) - אם יש
- סה"כ יתרה נוכחית (total_balance)
- סה"כ הפקדה חודשית (total_monthly_deposit)

### **2. תוכניות פנסיוניות (pension_plans):**
עבור כל תוכנית (קרן פנסיה, קופת גמל, קרן השתלמות, פוליסת ביטוח משולבת):

**שדות חובה:**
- סוג תוכנית (plan_type): "pension_fund", "provident_fund", "study_fund", "insurance_policy"
- שם חברה מנהלת (provider)
- שם תוכנית (plan_name)
- מספר תוכנית/פוליסה (policy_number)
- סטטוס (status): "active", "frozen", "settled"
- וותק - תאריך התחלה (start_date)
- יתרה נוכחית (current_balance)

**שדות אופציונליים:**
- הפקדה חודשית (monthly_deposit)
- הפקדת עובד (employee_deposit)
- הפקדת מעסיק (employer_deposit)
- גיל פרישה (retirement_age)
- חיסכון לקצבה (pension_savings)
- חיסכון להון (capital_savings)
- כיסויים ביטוחיים (insurance_coverage): ביטוח חיים, אובדן כושר עבודה, מחלות קשות וכו'
- תחזית בגיל פרישה (retirement_forecast)
- מסלול השקעה (investment_track)
- דמי ניהול (management_fees)

### **3. סיכום כיסויים ביטוחיים (insurance_summary):**
אם יש כיסויים ביטוחיים, חלץ:
- ביטוח חיים (life_insurance)
- ביטוח יסודי (basic_insurance)
- פנסיית שאירים (survivors_pension)
- אובדן כושר עבודה (disability)
- מחלות קשות (critical_illness)
- ביטוח סיעודי (nursing_care)
- נכות מתאונה (accident_disability)

## **פורמט JSON:**
{
  "report_info": {
    "report_date": "16/03/2023",
    "customer_name": "אביתר באבאני",
    "id_number": "039854880",
    "agent_name": "גדי ברקאי",
    "total_balance": 11547.00,
    "total_monthly_deposit": 1666.00
  },
  "pension_plans": [
    {
      "plan_type": "pension_fund",
      "provider": "הפניקס",
      "plan_name": "הפניקס פנסיה מקיפה",
      "policy_number": "1124800010",
      "status": "frozen",
      "start_date": "01/03/2006",
      "current_balance": 24.00,
      "monthly_deposit": 0,
      "retirement_age": 67,
      "pension_savings": 24.00,
      "retirement_forecast": 75.00,
      "insurance_coverage": {
        "life_insurance": 398.00,
        "disability": 6007.00
      }
    }
  ],
  "insurance_summary": {
    "life_insurance": 398.00,
    "survivors_pension": 0,
    "disability": 8009.00,
    "critical_illness": 6007.00,
    "nursing_care": 0
  },
  "summary": {
    "total_plans": 5,
    "active_plans": 3,
    "frozen_plans": 2,
    "total_balance": 11547.00,
    "total_monthly_deposit": 1666.00,
    "by_type": {
      "pension_fund": 1,
      "provident_fund": 2,
      "study_fund": 1,
      "insurance_policy": 1
    }
  }
}

**הדוח:**
${text}

**חלץ את כל התוכניות - גם קפואות וגם פעילות!**`;

    const response = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'medium' },
      max_output_tokens: 16000,
    });
    
    const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(2);
    console.log(`✅ GPT-5 completed in ${analysisTime}s\n`);
    
    const content = response.output_text || '{}';
    
    // Parse JSON
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (match) jsonStr = match[1];
    } else {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) jsonStr = match[0];
    }
    
    const result = JSON.parse(jsonStr);
    
    // Display results
    console.log('🏦 **מידע כללי:**\n');
    if (result.report_info) {
      console.log(`   👤 לקוח: ${result.report_info.customer_name || 'N/A'}`);
      console.log(`   🆔 ת.ז: ${result.report_info.id_number || 'N/A'}`);
      console.log(`   📅 תאריך: ${result.report_info.report_date || 'N/A'}`);
      console.log(`   💰 יתרה כוללת: ₪${result.report_info.total_balance?.toLocaleString() || 'N/A'}`);
      console.log(`   📈 הפקדה חודשית: ₪${result.report_info.total_monthly_deposit?.toLocaleString() || 'N/A'}\n`);
    }

    if (result.summary) {
      console.log('📊 **סיכום:**\n');
      console.log(`   סה"כ תוכניות: ${result.summary.total_plans || 0}`);
      console.log(`   פעילות: ${result.summary.active_plans || 0}`);
      console.log(`   קפואות: ${result.summary.frozen_plans || 0}`);
      
      if (result.summary.by_type) {
        console.log(`\n   פילוח לפי סוג:`);
        Object.entries(result.summary.by_type).forEach(([type, count]) => {
          const typeNames = {
            pension_fund: 'קרנות פנסיה',
            provident_fund: 'קופות גמל',
            study_fund: 'קרנות השתלמות',
            insurance_policy: 'פוליסות ביטוח'
          };
          console.log(`   - ${typeNames[type] || type}: ${count}`);
        });
      }
      console.log();
    }

    if (result.pension_plans && result.pension_plans.length > 0) {
      // Group by type
      const byType = {};
      result.pension_plans.forEach(p => {
        if (!byType[p.plan_type]) byType[p.plan_type] = [];
        byType[p.plan_type].push(p);
      });

      const typeNames = {
        pension_fund: 'קרנות פנסיה',
        provident_fund: 'קופות גמל',
        study_fund: 'קרנות השתלמות',
        insurance_policy: 'פוליסות ביטוח'
      };

      Object.entries(byType).forEach(([type, plans]) => {
        console.log(`\n🏷️  **${typeNames[type] || type}** (${plans.length}):\n`);
        
        plans.forEach((p, index) => {
          console.log(`   ${index + 1}. ${p.plan_name || p.provider}`);
          console.log(`      חברה: ${p.provider}`);
          console.log(`      מספר: ${p.policy_number || 'N/A'}`);
          console.log(`      סטטוס: ${p.status}`);
          if (p.start_date) console.log(`      וותק: ${p.start_date}`);
          if (p.current_balance !== undefined) {
            console.log(`      יתרה: ₪${p.current_balance?.toLocaleString()}`);
          }
          if (p.monthly_deposit) {
            console.log(`      הפקדה: ₪${p.monthly_deposit?.toLocaleString()}/חודש`);
          }
          if (p.retirement_age) {
            console.log(`      גיל פרישה: ${p.retirement_age}`);
          }
          if (p.insurance_coverage) {
            console.log(`      כיסויים: ${Object.keys(p.insurance_coverage).length} סוגים`);
          }
          console.log();
        });
      });
    }

    if (result.insurance_summary) {
      console.log(`\n🛡️  **סיכום כיסויים ביטוחיים:**\n`);
      const coverageNames = {
        life_insurance: 'ביטוח חיים',
        survivors_pension: 'פנסיית שאירים',
        disability: 'אובדן כושר עבודה',
        critical_illness: 'מחלות קשות',
        nursing_care: 'ביטוח סיעודי'
      };
      
      Object.entries(result.insurance_summary).forEach(([key, value]) => {
        if (value > 0) {
          console.log(`   ${coverageNames[key] || key}: ₪${value?.toLocaleString()}`);
        }
      });
      console.log();
    }
    
    // Save
    const outputFile = reportType === 'short' 
      ? 'pension-short-analysis.json' 
      : 'pension-full-analysis.json';
    
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`💾 Saved to: ${outputFile}`);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  TOTAL TIME: ${totalTime}s`);

    return result;
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Analyze both reports
async function analyzeAll() {
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📊 מתחיל ניתוח דוחות מסלקה פנסיונית\n');
  console.log('═══════════════════════════════════════════════════════\n\n');

  try {
    // Analyze short report
    console.log('🔍 מנתח דוח מקוצר...\n');
    const shortResult = await analyzePensionReport('test-pension-short.txt', 'short');
    
    console.log('\n\n═══════════════════════════════════════════════════════\n');
    
    // Analyze full report
    console.log('🔍 מנתח דוח מורחב...\n');
    const fullResult = await analyzePensionReport('test-pension-full.txt', 'full');
    
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('✅ הושלם ניתוח שני הדוחות!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Failed to analyze reports:', error);
  }
}

analyzeAll();








