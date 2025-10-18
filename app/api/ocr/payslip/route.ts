import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Tesseract from "tesseract.js";

// Helper function to extract numbers from text
function extractNumber(text: string, keywords: string[]): number | null {
  for (const keyword of keywords) {
    const pattern = new RegExp(`${keyword}[:\\s]+([\\d,]+(?:\\.\\d{2})?)`, 'i');
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }
  return null;
}

// Helper function to extract employer name
function extractEmployerName(text: string): string {
  const patterns = [
    /חברה:\s*(.+)/i,
    /מעסיק:\s*(.+)/i,
    /שם מעביד:\s*(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().substring(0, 50);
    }
  }
  
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // OCR with Tesseract - Hebrew + English
    const { data: { text } } = await Tesseract.recognize(buffer, "heb+eng", {
      logger: (m) => console.log(m),
    });

    console.log("OCR Text:", text);

    // Extract data from text
    const gross = extractNumber(text, [
      "ברוטו",
      "gross",
      "שכר ברוטו",
      "משכורת ברוטו",
    ]);

    const net = extractNumber(text, [
      "נטו",
      "net",
      "נטו לתשלום",
      "לתשלום",
      "שכר נטו",
    ]);

    const pension = extractNumber(text, [
      "פנסיה",
      "pension",
      "קרן פנסיה",
      "הפרשה לפנסיה",
    ]);

    const advancedStudy = extractNumber(text, [
      "קרן השתלמות",
      "קה\"ש",
      "קהש",
      "advanced study",
    ]);

    const tax = extractNumber(text, [
      "מס הכנסה",
      "מס",
      "tax",
      "income tax",
    ]);

    const nationalInsurance = extractNumber(text, [
      "ביטוח לאומי",
      "ביל\"ן",
      "ביטוח",
      "national insurance",
    ]);

    const employerName = extractEmployerName(text);

    // Calculate confidence based on how many fields we found
    const fieldsFound = [gross, net, pension, advancedStudy, tax, nationalInsurance].filter(x => x !== null).length;
    const confidence = fieldsFound / 6; // 0-1 scale

    const payslipData = {
      gross,
      net,
      pension,
      advancedStudy,
      tax,
      nationalInsurance,
      employerName,
      confidence,
    };

    return NextResponse.json({
      success: true,
      data: payslipData,
      raw_text: text, // For debugging
    });
  } catch (error: any) {
    console.error("Error in POST /api/ocr/payslip:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

