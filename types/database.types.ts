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
      loan_documents: {
        Row: {
          application_id: string
          document_category: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          document_category: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          document_category?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          ai_personality: Json | null
          birth_date: string | null
          children_count: number | null
          city: string | null
          created_at: string | null
          email: string
          employment_status: string | null
          id: string
          locale: string | null
          marital_status: string | null
          name: string
          phase: string | null
          phone: string | null
          subscription_status: string | null
          updated_at: string | null
          wa_opt_in: boolean | null
        }
        Insert: {
          ai_personality?: Json | null
          birth_date?: string | null
          children_count?: number | null
          city?: string | null
          created_at?: string | null
          email: string
          employment_status?: string | null
          id: string
          locale?: string | null
          marital_status?: string | null
          name: string
          phase?: string | null
          phone?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          wa_opt_in?: boolean | null
        }
        Update: {
          ai_personality?: Json | null
          birth_date?: string | null
          children_count?: number | null
          city?: string | null
          created_at?: string | null
          email?: string
          employment_status?: string | null
          id?: string
          locale?: string | null
          marital_status?: string | null
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
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
