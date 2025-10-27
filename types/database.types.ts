export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      loan_applications: {
        Row: {
          additional_amount: number | null
          applicant_email: string | null
          applicant_id_number: string | null
          applicant_name: string | null
          applicant_phone: string | null
          application_type: string
          business_name: string | null
          business_number: string | null
          completed_steps: Json | null
          created_at: string | null
          employment_type: string
          gadi_notes: string | null
          id: string
          property_address: string | null
          property_value: number | null
          purpose: string | null
          requested_amount: number | null
          requested_term_months: number | null
          required_documents: Json | null
          reviewed_at: string | null
          spouse_employment_type: string | null
          spouse_id_number: string | null
          spouse_name: string | null
          status: string
          submitted_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_amount?: number | null
          applicant_email?: string | null
          applicant_id_number?: string | null
          applicant_name?: string | null
          applicant_phone?: string | null
          application_type: string
          business_name?: string | null
          business_number?: string | null
          completed_steps?: Json | null
          created_at?: string | null
          employment_type: string
          gadi_notes?: string | null
          id?: string
          property_address?: string | null
          property_value?: number | null
          purpose?: string | null
          requested_amount?: number | null
          requested_term_months?: number | null
          required_documents?: Json | null
          reviewed_at?: string | null
          spouse_employment_type?: string | null
          spouse_id_number?: string | null
          spouse_name?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_amount?: number | null
          applicant_email?: string | null
          applicant_id_number?: string | null
          applicant_name?: string | null
          applicant_phone?: string | null
          application_type?: string
          business_name?: string | null
          business_number?: string | null
          completed_steps?: Json | null
          created_at?: string | null
          employment_type?: string
          gadi_notes?: string | null
          id?: string
          property_address?: string | null
          property_value?: number | null
          purpose?: string | null
          requested_amount?: number | null
          requested_term_months?: number | null
          required_documents?: Json | null
          reviewed_at?: string | null
          spouse_employment_type?: string | null
          spouse_id_number?: string | null
          spouse_name?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          auto_categorized: boolean | null
          category: string
          category_group: string | null
          category_id: string | null
          confidence_score: number | null
          created_at: string | null
          currency: string | null
          date: string
          detailed_category: string | null
          expense_frequency: string | null
          expense_type: string | null
          id: string
          is_recurring: boolean | null
          notes: string | null
          original_description: string | null
          parent_transaction_id: string | null
          payment_method: string | null
          recurrence_pattern: string | null
          source: string
          status: string
          tx_date: string | null
          type: string
          updated_at: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          auto_categorized?: boolean | null
          category: string
          category_group?: string | null
          category_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          detailed_category?: string | null
          expense_frequency?: string | null
          expense_type?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          original_description?: string | null
          parent_transaction_id?: string | null
          payment_method?: string | null
          recurrence_pattern?: string | null
          source?: string
          status?: string
          tx_date?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          auto_categorized?: boolean | null
          category?: string
          category_group?: string | null
          category_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          currency?: string | null
          date?: string
          detailed_category?: string | null
          expense_frequency?: string | null
          expense_type?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          original_description?: string | null
          parent_transaction_id?: string | null
          payment_method?: string | null
          recurrence_pattern?: string | null
          source?: string
          status?: string
          tx_date?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          ai_personality: Json | null
          created_at: string | null
          email: string
          employment_status: string | null
          id: string
          locale: string | null
          name: string
          phase: string | null
          phone: string | null
          subscription_status: string | null
          updated_at: string | null
          wa_opt_in: boolean | null
        }
        Insert: {
          ai_personality?: Json | null
          created_at?: string | null
          email: string
          employment_status?: string | null
          id?: string
          locale?: string | null
          name: string
          phase?: string | null
          phone?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          wa_opt_in?: boolean | null
        }
        Update: {
          ai_personality?: Json | null
          created_at?: string | null
          email?: string
          employment_status?: string | null
          id?: string
          locale?: string | null
          name?: string
          phase?: string | null
          phone?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          wa_opt_in?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

