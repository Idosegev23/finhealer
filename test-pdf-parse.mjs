import fs from 'fs';
import path from 'path';
import * as pdfParse from 'pdf-parse';

// Test pdf-parse with the specific PDF file
async function testPdfParse() {
  try {
    console.log('📝 Testing pdf-parse with Hebrew PDF...');

    // Read the specific PDF file
    const pdfPath = '/Users/idosegev/Downloads/גדי ברקאי דוח עוש וכ.א.pdf';
    console.log(`📁 Reading PDF: ${pdfPath}`);

    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found at:', pdfPath);
      return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    console.log(`📄 PDF size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Parse with pdf-parse
    console.log('🔄 Parsing with pdf-parse...');
    const startTime = Date.now();

    const pdfData = await pdfParse(pdfBuffer);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ pdf-parse completed in ${duration}s`);
    console.log(`📄 Pages: ${pdfData.numpages}`);
    console.log(`📝 Text length: ${pdfData.text.length} characters`);

    console.log('\n📋 RAW EXTRACTED TEXT:');
    console.log('=' .repeat(50));
    console.log(pdfData.text);
    console.log('=' .repeat(50));

    // Test our RTL fix function
    console.log('\n🔧 Testing RTL text fixes...');

    function fixRTLTextFromPDF(text) {
      try {
        // Split into lines
        const lines = text.split('\n');

        const fixedLines = lines.map(line => {
          // 1. Fix reversed English/Latin text - be more aggressive with reversal
          let fixedLine = line.replace(/[A-Za-z0-9._\-@\/]+/g, (match) => {
            // Always try reversing to see if it makes more sense
            const reversed = match.split('').reverse().join('');

            // Strong indicators that reversal is correct:
            if (
              // Domain names
              reversed.match(/\.(com|net|org|il|co\.il|gov|edu|app|io|ai)$/i) ||
              // URLs
              reversed.match(/^(www|http|https|ftp)/i) ||
              // Email
              reversed.includes('@') ||
              // File extensions
              reversed.match(/\.(pdf|jpg|png|docx?)$/i) ||
              // Common tech/brand names (must start with capital)
              reversed.match(/^(CURSOR|OPENAI|VERCEL|ANTHROPIC|GOOGLE|MICROSOFT|ADOBE|NETFLIX|ZOOM|APPLE|PAYPAL|AMAZON|STRIPE|GITHUB|GITLAB|SLACK|DISCORD|TELEGRAM|WHATSAPP|FACEBOOK|INSTAGRAM|TWITTER|LINKEDIN|YOUTUBE|SPOTIFY|DROPBOX|NOTION|FIGMA|CANVA|PAYBOX|PAYPAL|BIT|MASTERCARD|VISA|AMERICAN|EXPRESS|DISCOVER)/i) ||
              // Common English words that indicate proper direction
              reversed.match(/^(usage|subscription|payment|invoice|receipt|statement|report|summary|total|balance|credit|debit|account|customer|vendor|service|product|order|transaction|fee|charge|refund|discount|tax|vat|net|gross|atm|cash|check|transfer|deposit|withdrawal)/i) ||
              // Common business names
              reversed.match(/^(supermarket|pharmacy|restaurant|gas|fuel|electricity|water|internet|phone|mobile|telecom|insurance|bank|credit|card|loan|mortgage)/i)
            ) {
              return reversed;
            }

            // If original looks like gibberish but reversed looks like real words, reverse it
            // Check if reversed version has more common letter patterns
            const reversedScore = (reversed.match(/[aeiou]/gi) || []).length; // vowel count
            const originalScore = (match.match(/[aeiou]/gi) || []).length;

            // More aggressive reversal - if it looks like a business name or contains numbers
            if (reversedScore > originalScore || match.match(/\d/) || reversed.match(/^[A-Z]/)) {
              return reversed;
            }

            return match; // Keep original if unsure
          });

          // 2. Fix Hebrew text - add spaces between concatenated words and fix common RTL issues
          fixedLine = fixedLine
            // Fix common Hebrew business name concatenations
            .replace(/(סופרפארם)(ברנע[^\s]*)/g, '$1 $2') // סופרפארם ברנעאשקלון → סופר פארם ברנע אשקלון
            .replace(/(שופרסל)([^\s]+)/g, '$1 $2') // שופרסלדיל → שופרסל דיל
            .replace(/(פז)([^\s]*אפליקצ[^\s]*)/g, '$1 $2') // פזאפליקצייתיילו → פז אפליקציית יילו
            .replace(/(בנק)([^\s]*)/g, '$1 $2') // בנקדיסקונט → בנק דיסקונט
            .replace(/(מגדל)([^\s]*)/g, '$1 $2') // מגדלחיים → מגדל חיים
            .replace(/(הראל)([^\s]*)/g, '$1 $2') // הראלביטוח → הראל ביטוח
            .replace(/(קרן)([^\s]*מכבי[^\s]*)/g, '$1 $2') // קרןמכבי → קרן מכבי
            .replace(/(ויזה|מסטרקארד|אמריקן|אקספרס)/g, ' $1 ') // Add spaces around card names
            // Fix amounts with shekel sign
            .replace(/(\d+[,.]?\d*)\s*₪/g, '$1 ₪') // 500₪ → 500 ₪
            // Fix dates
            .replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, '$1/$2/$3') // Ensure consistent date format
            // סופר + דוידי/פארם → סופר דוידי/פארם
            .replace(/(סופר)(דוידי|פארם|דיל)/g, '$1 $2')
            // בזק/פלאפון + חשבון → בזק חשבון
            .replace(/(בזק|פלאפון|הוט|סלקום)(חשבון[^\s]*)/g, '$1 $2')
            // קרן + מכבי/כללית → קרן מכבי
            .replace(/(קרן|ביטוח)(מכבי|כללית|לאומי|הראל|מגדל)/g, '$1 $2')
            // מקדונלד'ס, ארקפה, etc - city names stuck to brand
            .replace(/(מקדונלד'ס|ארקפה|בורגר[^\s]+|קפה[^\s]+)(תל[^\s]+|ירושל[^\s]+|חיפה|אשקלון|אשדוד|רחובות|פתח[^\s]+)/g, '$1 $2');

          return fixedLine;
        });

        return fixedLines.join('\n');
      } catch (error) {
        console.error('Error in fixRTLTextFromPDF:', error);
        return text; // Return original on error
      }
    }

    const fixedText = fixRTLTextFromPDF(pdfData.text);

    console.log('\n🔧 FIXED TEXT:');
    console.log('=' .repeat(50));
    console.log(fixedText);
    console.log('=' .repeat(50));

    // Show some key lines
    console.log('\n🔍 KEY LINES ANALYSIS:');
    const lines = fixedText.split('\n').filter(line => line.trim().length > 10);
    lines.slice(0, 20).forEach((line, i) => {
      console.log(`${i + 1}: ${line}`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPdfParse();
