import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeStatement() {
  const startTime = Date.now();
  
  try {
    console.log('🤖 Starting GPT-5 smart bank analysis...\n');
    
    const text = fs.readFileSync('test-bank-statement.txt', 'utf-8');
    console.log(`📄 Text length: ${text.length} characters\n`);
    
    const analysisStart = Date.now();
    
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: `אתה מומחה בניתוח דוחות בנק ישראליים.

נתח את דוח הבנק הבא וחלץ את **כל המידע** בצורה מובנית.

🔴 **חשוב: סווג נכון כל תנועה לפי סוגה!** 🔴

## **1. מידע כללי**
חלץ:
- תאריך התחלה (from_date)
- תאריך סיום (to_date)
- יתרה פותחת (opening_balance)
- יתרה סוגרת (closing_balance)
- מספר חשבון (account_number)
- שם החשבון (account_name)

## **2. תנועות לפי סוג**

### **הכנסות (income)** - כל זכות שמגדילה את היתרה:
- משכורת
- העברות שקיבלתי (גם מחשבונות אחרים שלי!)
- החזרי מס
- גמלאות
- הכנסות מהשקעות
- דיבידנדים
- ביטול חיוב
- **כלל: כל תנועה עם סימן (+) או "זכות"**

### **הוצאות (expense)** - כל חיוב שמקטין את היתרה:
- קניות
- חשבונות (חשמל, מים, ארנונה, טלפון)
- העברות שעשיתי (גם לחשבונות אחרים שלי!)
- משיכות מזומן
- עמלות
- **כלל: כל תנועה עם סימן (-) או "חיוב"**

**חריגים מיוחדים:**

### **הלוואות (loan_payment)** - זיהוי לפי תיאור:
- "בנק לאומי/דיסקונט/מזרחי - הלוואה"
- "החזר הלוואה"
- "החזר משכנתא"
- אם יש פירוט קרן וריבית - חלץ אותם
- **סווג כ-expense אבל תעד בנפרד**

### **חיסכון (savings_transfer)** - זיהוי לפי תיאור:
- "העברה לפיקדון"
- "העברה לחיסכון"
- "קרן השתלמות"
- "קופת גמל"
- **סווג כ-expense אבל תעד בנפרד**

## **פורמט JSON:**
{
  "account_info": {
    "from_date": "01/10/2025",
    "to_date": "29/10/2025",
    "opening_balance": 5000.00,
    "closing_balance": 3500.00,
    "account_number": "123456",
    "account_name": "חשבון עו\\"ש"
  },
  "transactions": {
    "income": [
      {
        "date": "01/10/2025",
        "description": "משכורת - חברת ABC",
        "amount": 15000.00,
        "category": "משכורת"
      }
    ],
    "expenses": [
      {
        "date": "05/10/2025",
        "description": "סופר דוידי",
        "amount": 350.00,
        "category": "מזון"
      }
    ],
    "loan_payments": [
      {
        "date": "10/10/2025",
        "description": "בנק לאומי - החזר הלוואה",
        "amount": 2000.00,
        "principal": 1500.00,
        "interest": 500.00,
        "loan_provider": "בנק לאומי"
      }
    ],
    "savings_transfers": [
      {
        "date": "15/10/2025",
        "description": "העברה לפיקדון",
        "amount": 1000.00,
        "to_account": "פיקדון",
        "note": "סווג גם כ-expense"
      }
    ]
  }
}

**הדוח:**
${text}

**חלץ הכל - הכנסות, הוצאות, הלוואות, חיסכון - וסווג נכון!**`,
      reasoning: { effort: 'high' }, // גבוה כי צריך סיווג מדויק
      text: { verbosity: 'high' }, // גבוה כי יש הרבה מידע
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
    console.log('📊 **מידע כללי:**\n');
    if (result.account_info) {
      console.log(`   📅 תקופה: ${result.account_info.from_date} - ${result.account_info.to_date}`);
      console.log(`   💰 יתרה פותחת: ₪${result.account_info.opening_balance?.toFixed(2) || 'N/A'}`);
      console.log(`   💰 יתרה סוגרת: ₪${result.account_info.closing_balance?.toFixed(2) || 'N/A'}`);
      console.log(`   🏦 חשבון: ${result.account_info.account_name || 'N/A'}\n`);
    }
    
    if (result.transactions) {
      const { income, expenses, loan_payments, savings_transfers } = result.transactions;
      
      console.log('✅ **סיכום תנועות:**\n');
      
      if (income?.length > 0) {
        const total = income.reduce((sum, tx) => sum + tx.amount, 0);
        console.log(`💰 הכנסות: ${income.length} | סה"כ: ₪${total.toFixed(2)}`);
        console.log('   דוגמאות:');
        income.slice(0, 3).forEach(tx => {
          console.log(`   ${tx.date} | ${tx.description.substring(0, 40)} | ₪${tx.amount.toFixed(2)}`);
        });
        console.log();
      }
      
      if (expenses?.length > 0) {
        const total = expenses.reduce((sum, tx) => sum + tx.amount, 0);
        console.log(`💳 הוצאות: ${expenses.length} | סה"כ: ₪${total.toFixed(2)}`);
        console.log('   דוגמאות:');
        expenses.slice(0, 3).forEach(tx => {
          console.log(`   ${tx.date} | ${tx.description.substring(0, 40)} | ₪${tx.amount.toFixed(2)}`);
        });
        console.log();
      }
      
      if (loan_payments?.length > 0) {
        const total = loan_payments.reduce((sum, tx) => sum + tx.amount, 0);
        console.log(`🏦 החזרי הלוואות: ${loan_payments.length} | סה"כ: ₪${total.toFixed(2)}`);
        loan_payments.forEach(tx => {
          console.log(`   ${tx.date} | ${tx.loan_provider} | קרן: ₪${tx.principal} | ריבית: ₪${tx.interest}`);
        });
        console.log();
      }
      
      if (savings_transfers?.length > 0) {
        const total = savings_transfers.reduce((sum, tx) => sum + tx.amount, 0);
        console.log(`💎 העברות לחיסכון: ${savings_transfers.length} | סה"כ: ₪${total.toFixed(2)}`);
        console.log('   (נספרות גם כהוצאה)');
        console.log();
      }
    }
    
    // Save
    fs.writeFileSync('bank-smart-analysis.json', JSON.stringify(result, null, 2), 'utf-8');
    console.log('💾 Saved to: bank-smart-analysis.json');
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  TOTAL TIME: ${totalTime}s`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

analyzeStatement();

