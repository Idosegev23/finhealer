#!/usr/bin/env node

/**
 * Test script for PDF analysis without the full server
 * Usage: node test-pdf-analysis.js <path-to-pdf>
 */

const fs = require('fs');
const path = require('path');

async function analyzePDF(pdfPath) {
  console.log(`📄 Testing PDF: ${pdfPath}\n`);
  
  try {
    // 1. Read PDF file
    const buffer = fs.readFileSync(pdfPath);
    console.log(`✅ File read: ${buffer.length} bytes\n`);
    
    // 2. Extract text using unpdf
    const { getDocumentProxy, extractText } = require('unpdf');
    
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: rawText } = await extractText(pdf, { mergePages: true });
    
    console.log(`✅ Text extracted: ${rawText.length} characters, ${totalPages} pages\n`);
    
    // 3. Show first 500 chars
    console.log('📝 First 500 characters:');
    console.log('─'.repeat(80));
    console.log(rawText.substring(0, 500));
    console.log('─'.repeat(80));
    console.log();
    
    // 4. Show last 500 chars
    console.log('📝 Last 500 characters:');
    console.log('─'.repeat(80));
    console.log(rawText.substring(rawText.length - 500));
    console.log('─'.repeat(80));
    console.log();
    
    // 5. Statistics
    console.log('📊 Statistics:');
    console.log(`   Total characters: ${rawText.length.toLocaleString()}`);
    console.log(`   Estimated tokens: ~${Math.ceil(rawText.length / 4).toLocaleString()}`);
    console.log(`   Total pages: ${totalPages}`);
    console.log(`   Avg chars/page: ${Math.round(rawText.length / totalPages).toLocaleString()}`);
    
    // 6. Check if would be truncated (old limit)
    const OLD_LIMIT = 15000;
    if (rawText.length > OLD_LIMIT) {
      console.log(`\n⚠️  OLD BEHAVIOR: Would truncate to ${OLD_LIMIT} chars`);
      console.log(`   Lost: ${(rawText.length - OLD_LIMIT).toLocaleString()} characters (${Math.round((rawText.length - OLD_LIMIT) / rawText.length * 100)}%)`);
    } else {
      console.log(`\n✅ OLD BEHAVIOR: Would NOT truncate (within limit)`);
    }
    
    console.log(`\n✅ NEW BEHAVIOR: Send all ${rawText.length.toLocaleString()} characters to GPT-4o`);
    
    // 7. Save full text to file for inspection
    const outputPath = pdfPath.replace('.pdf', '-extracted.txt');
    fs.writeFileSync(outputPath, rawText);
    console.log(`\n💾 Full text saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Main
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: node test-pdf-analysis.js <path-to-pdf>');
  process.exit(1);
}

if (!fs.existsSync(pdfPath)) {
  console.error(`Error: File not found: ${pdfPath}`);
  process.exit(1);
}

analyzePDF(pdfPath);

