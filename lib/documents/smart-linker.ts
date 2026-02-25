import { createClient } from "@/lib/supabase/server";

/**
 * Smart Document Linker
 * Intelligently links related documents (e.g., bank statement credit card payments to credit card statements)
 */

export interface DocumentLink {
  id: string;
  userId: string;
  documentType: "bank_statement" | "credit_card" | "receipt" | "other";
  documentId: string;
  linkedDocumentId?: string;
  linkType: "credit_payment" | "transfer" | "refund" | "duplicate";
  linkReason: string;
  confidence: number;
  createdAt: Date;
}

export interface CreditCardPayment {
  transactionId: string;
  amount: number;
  date: Date;
  merchantName: string;
}

/**
 * Analyze document for potential links to other documents
 */
export async function analyzeDocumentLinks(
  userId: string,
  documentId: string,
  documentType: string,
  transactions: any[]
): Promise<DocumentLink[]> {
  const links: DocumentLink[] = [];

  if (documentType === "bank_statement") {
    // Look for credit card payments in bank statement
    const creditPayments = await findCreditCardPayments(transactions);

    for (const payment of creditPayments) {
      // Check if we need the credit card statement
      const needsStatement = await checkIfNeedsCreditCardStatement(
        userId,
        payment
      );

      if (needsStatement) {
        links.push({
          id: `${documentId}-${payment.transactionId}`,
          userId,
          documentType: "bank_statement",
          documentId,
          linkType: "credit_payment",
          linkReason: `מצאתי תשלום אשראי של ${payment.amount} ₪ ב-${payment.date.toLocaleDateString('he-IL')}. צריך פירוט אשראי עד תאריך זה.`,
          confidence: 0.9,
          createdAt: new Date(),
        });
      }
    }
  }

  if (documentType === "credit_card") {
    // Check if this credit card statement links to a bank payment
    const linkedPayment = await findLinkedBankPayment(userId, transactions);

    if (linkedPayment) {
      links.push({
        id: `${documentId}-bank`,
        userId,
        documentType: "credit_card",
        documentId,
        linkedDocumentId: linkedPayment.documentId,
        linkType: "credit_payment",
        linkReason: "פירוט אשראי זה מקושר לתשלום בדוח הבנק",
        confidence: 0.85,
        createdAt: new Date(),
      });
    }
  }

  return links;
}

/**
 * Find credit card payments in bank transactions
 */
async function findCreditCardPayments(
  transactions: any[]
): Promise<CreditCardPayment[]> {
  const payments: CreditCardPayment[] = [];

  // Keywords that indicate credit card payment
  const creditKeywords = [
    "אשראי",
    "ויזה",
    "visa",
    "מאסטרקארד",
    "mastercard",
    "כרטיס",
    "ישראכרט",
    "לאומי קארד",
    "מקס",
  ];

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;

    const description = (tx.description || "").toLowerCase();
    const merchantName = (tx.merchant_name || "").toLowerCase();

    const isCreditPayment = creditKeywords.some(
      (keyword) =>
        description.includes(keyword) || merchantName.includes(keyword)
    );

    if (isCreditPayment && tx.amount > 100) {
      // Credit payments are usually significant amounts
      payments.push({
        transactionId: tx.id,
        amount: tx.amount,
        date: new Date(tx.date),
        merchantName: tx.merchant_name || tx.description,
      });
    }
  }

  return payments;
}

/**
 * Check if we need credit card statement for this payment
 */
async function checkIfNeedsCreditCardStatement(
  userId: string,
  payment: CreditCardPayment
): Promise<boolean> {
  const supabase = await createClient();

  // Check if we already have credit card transactions around this date
  const paymentDate = payment.date;
  const startDate = new Date(paymentDate);
  startDate.setDate(startDate.getDate() - 35); // 35 days before

  const endDate = new Date(paymentDate);
  endDate.setDate(endDate.getDate() + 5); // 5 days after

  const { data: existingTransactions } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .gte("tx_date", startDate.toISOString())
    .lte("tx_date", endDate.toISOString())
    .eq("source", "bank_import"); // Only look at imported transactions

  if (!existingTransactions) return true;

  // Calculate total of existing transactions
  const totalExisting = existingTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  );

  // If existing transactions don't add up to credit payment, we need statement
  const difference = Math.abs(totalExisting - payment.amount);
  const percentageDiff = difference / payment.amount;

  // If more than 20% difference, we need the credit statement
  return percentageDiff > 0.2;
}

/**
 * Find linked bank payment for credit card statement
 */
async function findLinkedBankPayment(
  userId: string,
  creditTransactions: any[]
): Promise<{ documentId: string; transactionId: string } | null> {
  const supabase = await createClient();

  // Calculate total of credit card transactions
  const total = creditTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0
  );

  // Find the latest date in credit card transactions
  const latestDate = creditTransactions.reduce((latest, tx) => {
    const txDate = new Date(tx.tx_date);
    return txDate > latest ? txDate : latest;
  }, new Date(0));

  // Look for bank payment around this amount after this date
  const searchStart = new Date(latestDate);
  searchStart.setDate(searchStart.getDate() + 5); // 5 days after latest transaction

  const searchEnd = new Date(latestDate);
  searchEnd.setDate(searchEnd.getDate() + 45); // Up to 45 days after

  const { data: bankPayments } = await supabase
    .from("transactions")
    .select("id, amount, document_id")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("tx_date", searchStart.toISOString())
    .lte("tx_date", searchEnd.toISOString());

  if (!bankPayments) return null;

  // Find payment that matches the total (within 5%)
  for (const payment of bankPayments) {
    const difference = Math.abs(payment.amount - total);
    const percentageDiff = difference / total;

    if (percentageDiff < 0.05) {
      // Within 5%
      return {
        documentId: payment.document_id,
        transactionId: payment.id,
      };
    }
  }

  return null;
}

/**
 * Generate smart request message for missing document
 */
export function generateDocumentRequestMessage(
  link: DocumentLink
): string {
  if (link.linkType === "credit_payment") {
    return `${link.linkReason}\n\nאפשר לשלוח את דוח האשראי? 📄\nזה יעזור לי לפרט את ההוצאות בצורה מדויקת.`;
  }

  return "יש מסמך קשור שיכול לעזור. אפשר לשלוח?";
}

/**
 * Save document link to database
 */
export async function saveDocumentLink(link: DocumentLink): Promise<void> {
  const supabase = await createClient();

  await supabase.from("document_links").insert({
    user_id: link.userId,
    document_type: link.documentType,
    document_id: link.documentId,
    linked_document_id: link.linkedDocumentId,
    link_type: link.linkType,
    link_reason: link.linkReason,
    confidence: link.confidence,
  });
}

/**
 * Get pending document requests for user
 */
export async function getPendingDocumentRequests(
  userId: string
): Promise<DocumentLink[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("document_links")
    .select("*")
    .eq("user_id", userId)
    .is("linked_document_id", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((link: any) => ({
    id: link.id,
    userId: link.user_id,
    documentType: link.document_type,
    documentId: link.document_id,
    linkedDocumentId: link.linked_document_id,
    linkType: link.link_type,
    linkReason: link.link_reason,
    confidence: link.confidence,
    createdAt: new Date(link.created_at),
  }));
}

/**
 * Mark document link as fulfilled
 */
export async function fulfillDocumentLink(
  linkId: string,
  linkedDocumentId: string
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("document_links")
    .update({
      linked_document_id: linkedDocumentId,
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", linkId);
}

/**
 * Detect duplicate documents
 */
export async function detectDuplicateDocuments(
  userId: string,
  newDocumentId: string,
  transactions: any[]
): Promise<string | null> {
  const supabase = await createClient();

  // Get transaction hashes for new document
  const newHashes = transactions.map((tx) =>
    generateTransactionHash(tx)
  );

  // Get recent documents
  const { data: recentDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .neq("id", newDocumentId)
    .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days
    .limit(10);

  if (!recentDocs) return null;

  // Check each recent document for matches
  for (const doc of recentDocs) {
    const { data: docTransactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("document_id", doc.id);

    if (!docTransactions) continue;

    const docHashes = docTransactions.map((tx: any) =>
      generateTransactionHash(tx)
    );

    // Calculate overlap
    const overlap = newHashes.filter((hash) => docHashes.includes(hash)).length;
    const overlapPercent = overlap / Math.min(newHashes.length, docHashes.length);

    // If more than 80% overlap, likely duplicate
    if (overlapPercent > 0.8) {
      return doc.id;
    }
  }

  return null;
}

/**
 * Generate unique hash for transaction
 */
function generateTransactionHash(transaction: any): string {
  const { date, amount, merchant_name, description } = transaction;
  return `${date}-${amount}-${merchant_name || ""}-${description || ""}`;
}

export default {
  analyzeDocumentLinks,
  generateDocumentRequestMessage,
  saveDocumentLink,
  getPendingDocumentRequests,
  fulfillDocumentLink,
  detectDuplicateDocuments,
};

