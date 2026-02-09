/**
 * Types for Loan Consolidation System
 */

export type ConsolidationRequestStatus =
  | 'pending_documents'
  | 'documents_received'
  | 'sent_to_advisor'
  | 'advisor_reviewing'
  | 'offer_sent'
  | 'accepted'
  | 'rejected'
  | 'cancelled';

export interface LoanDocument {
  filename: string;
  url: string;
  loan_id: string;
  uploaded_at: string;
  size?: number;
}

export interface ConsolidationRequest {
  id: string;
  user_id: string;
  
  // Loans
  loan_ids: string[];
  loans_count: number;
  total_monthly_payment: number;
  total_balance: number;
  
  // Status
  status: ConsolidationRequestStatus;
  documents_received: number;
  documents_needed: number;
  loan_documents: LoanDocument[];
  
  // Lead
  lead_sent_at: string | null;
  lead_response: string | null;
  advisor_notes: string | null;
  
  // Offer
  proposed_rate: number | null;
  proposed_monthly_payment: number | null;
  proposed_total_amount: number | null;
  estimated_savings: number | null;
  
  created_at: string;
  updated_at: string;
}

export interface ConsolidationLeadData {
  // User info
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  
  // Request info
  request_id: string;
  loans_count: number;
  total_monthly_payment: number;
  total_balance: number;
  
  // Loans details
  loans: Array<{
    id: string;
    creditor: string;
    balance: number;
    monthly_payment: number;
    interest_rate: number | null;
    remaining_months: number | null;
  }>;
  
  // Documents
  documents: LoanDocument[];
  
  // Financial context
  monthly_income: number;
  monthly_expenses: number;
  phi_score: number;
  
  // Created
  created_at: string;
}

export interface ConsolidationOffer {
  request_id: string;
  proposed_rate: number;
  proposed_monthly_payment: number;
  proposed_total_amount: number;
  estimated_savings: number;
  advisor_notes?: string;
}
