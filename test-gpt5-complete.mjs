import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeStatement() {
  const startTime = Date.now();
  
  try {
    console.log('🤖 Starting GPT-5 analysis...\n');
    
    // Read extracted text
    const text = fs.readFileSync('test-extracted-text.txt', 'utf-8');
    console.log(`📄 Text length: ${text.length} characters\n`);
    
    const analysisStart = Date.now();
    
    // Using Responses API for GPT-5
    const response = await openai.responses.create({
      model: 'gpt-5',
      input: `אתה מומחה בניתוח דוחות אשראי ישראליים מסוג כאל/מקס.

נתח את דוח האשראי הבא וחלץ **כל** עסקה שמופיעה בו - ללא יוצא מן הכלל.

🔴 **קריטי ביותר - חלץ גם עסקאות בעברית!** 🔴

דוח זה מכיל עסקאות בשתי שפות:
1. **עברית**: סופר דוידי, שופרסל, יוחננוף, בבקה בייקרי, סיטי מרקט, פז, פלאפון, בזק וכו'
2. **אנגלית**: CURSOR, OPENAI, VERCEL, PROMEAI וכו'

**חובה לחלץ את שתי השפות!**

**סוגי עסקאות לחילוץ:**
✅ עסקאות רגילות (סופר דוידי, שופרסל, CURSOR, OPENAI)
✅ עסקאות עם תשלומים (תשלום 1 מ-2, תשלום 27 מ-48)
✅ עסקאות קרדיט (קרדיט 1 מ-3)
✅ הוראות קבע (קרן מכבי, פרי טיוי, ביטוחים)

**אל תדלג על אף עסקה - לא באנגלית ולא בעברית!**

עבור כל עסקה, חלץ:
- **תאריך** (DD/MM/YYYY)
- **שם בית העסק/ספק** (כפי שמופיע)
- **סכום בש"ח** (ללא סימן ₪)
- **קטגוריה** (אם מצוין)
- **סוג** (רגיל/תשלום/קרדיט/הוראת קבע)
- **פירוט תשלום** (אם יש - למשל "תשלום 2 מ-5")

**פורמט JSON בלבד:**
{
  "transactions": [
    {
      "date": "21/08/2025",
      "vendor": "שפירא גז בע'מ",
      "amount": 920.00,
      "category": "גז",
      "type": "תשלום",
      "installment": "תשלום 1 מ-2"
    },
    {
      "date": "12/08/2025",
      "vendor": "סופר דוידי",
      "amount": 350.00,
      "category": "מזון ומשקא",
      "type": "רגיל"
    }
  ]
}

**הדוח:**
${text}

**זכור: חלץ את כל העסקאות כולל תשלומים, קרדיט והוראות קבע!**`,
      reasoning: { effort: 'low' }, // Low reasoning for faster, more complete extraction
      text: { verbosity: 'high' }, // High verbosity for comprehensive output
      max_output_tokens: 16000,
    });
    
    const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(2);
    console.log(`✅ GPT-5 completed in ${analysisTime}s\n`);
    
    const content = response.output_text || '{}';
    
    // Parse JSON
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (match) jsonStr = match[1];
      } else {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
      }
      
      const result = JSON.parse(jsonStr);
      console.log(`📊 Found ${result.transactions?.length || 0} transactions\n`);
      
      if (result.transactions && result.transactions.length > 0) {
        // Group by type
        const byType = {
          'רגיל': [],
          'תשלום': [],
          'קרדיט': [],
          'הוראת קבע': []
        };
        
        result.transactions.forEach(tx => {
          const type = tx.type || 'רגיל';
          if (!byType[type]) byType[type] = [];
          byType[type].push(tx);
        });
        
        console.log('✅ סיכום לפי סוג:\n');
        Object.entries(byType).forEach(([type, txs]) => {
          if (txs.length > 0) {
            const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
            console.log(`📂 ${type}: ${txs.length} עסקאות | סה"כ: ₪${total.toFixed(2)}`);
          }
        });
        
        console.log('\n📋 דוגמאות מכל סוג:\n');
        Object.entries(byType).forEach(([type, txs]) => {
          if (txs.length > 0) {
            console.log(`\n${type}:`);
            txs.slice(0, 3).forEach(tx => {
              const installment = tx.installment ? ` [${tx.installment}]` : '';
              console.log(`  ${tx.date} | ${tx.vendor.substring(0, 30).padEnd(30)} | ₪${tx.amount.toFixed(2).padStart(8)}${installment}`);
            });
            if (txs.length > 3) {
              console.log(`  ... ועוד ${txs.length - 3} עסקאות`);
            }
          }
        });
        
        const total = result.transactions.reduce((sum, tx) => sum + tx.amount, 0);
        console.log(`\n💰 סה"כ כל העסקאות: ₪${total.toFixed(2)}`);
        
        // Save to file
        fs.writeFileSync('extracted-transactions.json', JSON.stringify(result, null, 2), 'utf-8');
        console.log('\n💾 Saved to: extracted-transactions.json');
      }
    } catch (e) {
      console.log('⚠️  Response was not valid JSON');
      console.log('Error:', e.message);
      console.log('\nResponse preview:', content.substring(0, 500));
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  TOTAL TIME: ${totalTime}s`);
    console.log(`   Input tokens: ${response.usage?.input_tokens || 'N/A'}`);
    console.log(`   Output tokens: ${response.usage?.output_tokens || 'N/A'}`);
    console.log(`   Reasoning tokens: ${response.usage?.reasoning_tokens || 'N/A'}`);
    console.log(`   Cost estimate: ~$${((response.usage?.input_tokens || 0) * 0.000001 + (response.usage?.output_tokens || 0) * 0.000004).toFixed(4)}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Failed after: ${totalTime}s`);
  }
}

analyzeStatement();
