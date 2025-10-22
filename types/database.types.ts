export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          permissions: Json | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permissions?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_notes: {
        Row: {
          advisor_id: string
          created_at: string | null
          id: string
          note_text: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          advisor_id: string
          created_at?: string | null
          id?: string
          note_text: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          advisor_id?: string
          created_at?: string | null
          id?: string
          note_text?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisor_notes_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_advisor_id_fkey"
            columns: ["advisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisor_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "advisor_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string | null
          id: string
          message: string
          params: Json | null
          read_at: string | null
          sent_at: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          params?: Json | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          params?: Json | null
          read_at?: string | null
          sent_at?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts_events: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          status: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts_rules: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          params: Json | null
          rule_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          params?: Json | null
          rule_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          params?: Json | null
          rule_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "alerts_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_insights: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          insight_text: string
          pattern: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          insight_text: string
          pattern: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          insight_text?: string
          pattern?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "behavior_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "behavior_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "behavior_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "behavior_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          monthly_cap: number
          name: string
          priority: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          monthly_cap: number
          name: string
          priority?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          monthly_cap?: number
          name?: string
          priority?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      default_categories: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          default_cap: number | null
          icon: string | null
          id: string
          name: string
          name_en: string | null
          sort_order: number | null
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          default_cap?: number | null
          icon?: string | null
          id?: string
          name: string
          name_en?: string | null
          sort_order?: number | null
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          default_cap?: number | null
          icon?: string | null
          id?: string
          name?: string
          name_en?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      dependents: {
        Row: {
          birth_date: string
          created_at: string | null
          gender: string | null
          id: string
          is_financially_supported: boolean | null
          name: string
          relationship_type: string
          support_notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          birth_date: string
          created_at?: string | null
          gender?: string | null
          id?: string
          is_financially_supported?: boolean | null
          name: string
          relationship_type: string
          support_notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          birth_date?: string
          created_at?: string | null
          gender?: string | null
          id?: string
          is_financially_supported?: boolean | null
          name?: string
          relationship_type?: string
          support_notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          applicable_to: string
          category_group: string | null
          created_at: string | null
          display_order: number | null
          expense_type: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          applicable_to: string
          category_group?: string | null
          created_at?: string | null
          display_order?: number | null
          expense_type: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          applicable_to?: string
          category_group?: string | null
          created_at?: string | null
          display_order?: number | null
          expense_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          child_name: string | null
          created_at: string | null
          current_amount: number | null
          deadline: string | null
          description: string | null
          id: string
          name: string
          priority: number | null
          status: string
          target_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          child_name?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          name: string
          priority?: number | null
          status?: string
          target_amount: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          child_name?: string | null
          created_at?: string | null
          current_amount?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          name?: string
          priority?: number | null
          status?: string
          target_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      income_sources: {
        Row: {
          active: boolean | null
          actual_bank_amount: number | null
          advanced_study_fund: number | null
          business_expenses: number | null
          created_at: string | null
          employer_name: string | null
          employment_type: string
          gross_amount: number
          health_tax: number | null
          id: string
          is_primary: boolean | null
          national_insurance: number | null
          net_amount: number
          notes: string | null
          other_deductions: number | null
          payment_frequency: string | null
          pension_contribution: number | null
          pension_fund_name: string | null
          source_name: string
          tax_rate: number | null
          updated_at: string | null
          user_id: string
          vat_registered: boolean | null
        }
        Insert: {
          active?: boolean | null
          actual_bank_amount?: number | null
          advanced_study_fund?: number | null
          business_expenses?: number | null
          created_at?: string | null
          employer_name?: string | null
          employment_type: string
          gross_amount: number
          health_tax?: number | null
          id?: string
          is_primary?: boolean | null
          national_insurance?: number | null
          net_amount: number
          notes?: string | null
          other_deductions?: number | null
          payment_frequency?: string | null
          pension_contribution?: number | null
          pension_fund_name?: string | null
          source_name: string
          tax_rate?: number | null
          updated_at?: string | null
          user_id: string
          vat_registered?: boolean | null
        }
        Update: {
          active?: boolean | null
          actual_bank_amount?: number | null
          advanced_study_fund?: number | null
          business_expenses?: number | null
          created_at?: string | null
          employer_name?: string | null
          employment_type?: string
          gross_amount?: number
          health_tax?: number | null
          id?: string
          is_primary?: boolean | null
          national_insurance?: number | null
          net_amount?: number
          notes?: string | null
          other_deductions?: number | null
          payment_frequency?: string | null
          pension_contribution?: number | null
          pension_fund_name?: string | null
          source_name?: string
          tax_rate?: number | null
          updated_at?: string | null
          user_id?: string
          vat_registered?: boolean | null
        }
        Relationships: []
      }
      insurance: {
        Row: {
          active: boolean | null
          annual_premium: number | null
          coverage_amount: number | null
          created_at: string | null
          end_date: string | null
          id: string
          insurance_type: string
          monthly_premium: number
          notes: string | null
          policy_number: string | null
          provider: string
          start_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          annual_premium?: number | null
          coverage_amount?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          insurance_type: string
          monthly_premium: number
          notes?: string | null
          policy_number?: string | null
          provider: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          annual_premium?: number | null
          coverage_amount?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          insurance_type?: string
          monthly_premium?: number
          notes?: string | null
          policy_number?: string | null
          provider?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
        Relationships: [
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "loan_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "user_loan_applications_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          active: boolean | null
          created_at: string | null
          current_balance: number
          end_date: string | null
          id: string
          interest_rate: number | null
          lender_name: string
          loan_number: string | null
          loan_type: string
          monthly_payment: number
          notes: string | null
          original_amount: number
          remaining_payments: number | null
          start_date: string | null
          statement_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          current_balance: number
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          lender_name: string
          loan_number?: string | null
          loan_type: string
          monthly_payment: number
          notes?: string | null
          original_amount: number
          remaining_payments?: number | null
          start_date?: string | null
          statement_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          current_balance?: number
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          lender_name?: string
          loan_number?: string | null
          loan_type?: string
          monthly_payment?: number
          notes?: string | null
          original_amount?: number
          remaining_payments?: number | null
          start_date?: string | null
          statement_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          active: boolean | null
          content: string
          created_at: string | null
          id: string
          language: string | null
          name: string
          type: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          active?: boolean | null
          content: string
          created_at?: string | null
          id?: string
          language?: string | null
          name: string
          type: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          active?: boolean | null
          content?: string
          created_at?: string | null
          id?: string
          language?: string | null
          name?: string
          type?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      pension_insurance: {
        Row: {
          active: boolean | null
          annual_return: number | null
          created_at: string | null
          current_balance: number | null
          deposit_fee_percentage: number | null
          employee_contribution: number | null
          employee_type: string | null
          employer_contribution: number | null
          fund_name: string
          fund_type: string
          id: string
          management_fee_percentage: number | null
          monthly_deposit: number | null
          notes: string | null
          policy_number: string | null
          provider: string
          seniority_date: string | null
          start_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          annual_return?: number | null
          created_at?: string | null
          current_balance?: number | null
          deposit_fee_percentage?: number | null
          employee_contribution?: number | null
          employee_type?: string | null
          employer_contribution?: number | null
          fund_name: string
          fund_type: string
          id?: string
          management_fee_percentage?: number | null
          monthly_deposit?: number | null
          notes?: string | null
          policy_number?: string | null
          provider: string
          seniority_date?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          annual_return?: number | null
          created_at?: string | null
          current_balance?: number | null
          deposit_fee_percentage?: number | null
          employee_contribution?: number | null
          employee_type?: string | null
          employer_contribution?: number | null
          fund_name?: string
          fund_type?: string
          id?: string
          management_fee_percentage?: number | null
          monthly_deposit?: number | null
          notes?: string | null
          policy_number?: string | null
          provider?: string
          seniority_date?: string | null
          start_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pension_report_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          gadi_notes: string | null
          id: string
          processed_at: string | null
          report_file_url: string | null
          requested_at: string
          status: string
          updated_at: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          gadi_notes?: string | null
          id?: string
          processed_at?: string | null
          report_file_url?: string | null
          requested_at?: string
          status?: string
          updated_at?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          gadi_notes?: string | null
          id?: string
          processed_at?: string | null
          report_file_url?: string | null
          requested_at?: string
          status?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number | null
          confidence: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          ocr_text: string | null
          status: string
          storage_path: string
          transaction_id: string | null
          tx_date: string | null
          updated_at: string | null
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          ocr_text?: string | null
          status?: string
          storage_path: string
          transaction_id?: string | null
          tx_date?: string | null
          updated_at?: string | null
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          ocr_text?: string | null
          status?: string
          storage_path?: string
          transaction_id?: string | null
          tx_date?: string | null
          updated_at?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_accounts: {
        Row: {
          account_name: string
          account_type: string
          active: boolean | null
          annual_return: number | null
          bank_name: string | null
          created_at: string | null
          current_balance: number | null
          goal_name: string | null
          id: string
          monthly_deposit: number | null
          notes: string | null
          target_amount: number | null
          target_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_type: string
          active?: boolean | null
          annual_return?: number | null
          bank_name?: string | null
          created_at?: string | null
          current_balance?: number | null
          goal_name?: string | null
          id?: string
          monthly_deposit?: number | null
          notes?: string | null
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_type?: string
          active?: boolean | null
          annual_return?: number | null
          bank_name?: string | null
          created_at?: string | null
          current_balance?: number | null
          goal_name?: string | null
          id?: string
          monthly_deposit?: number | null
          notes?: string | null
          target_amount?: number | null
          target_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          billing_cycle: string | null
          canceled_at: string | null
          created_at: string | null
          currency: string | null
          expires_at: string | null
          external_id: string | null
          id: string
          metadata: Json | null
          plan: string
          provider: string
          renewed_at: string | null
          started_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          plan?: string
          provider?: string
          renewed_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          billing_cycle?: string | null
          canceled_at?: string | null
          created_at?: string | null
          currency?: string | null
          expires_at?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json | null
          plan?: string
          provider?: string
          renewed_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          auto_categorized: boolean | null
          category: string
          category_group: string | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          date: string
          expense_type: string | null
          id: string
          notes: string | null
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
          created_at?: string | null
          currency?: string | null
          date?: string
          expense_type?: string | null
          id?: string
          notes?: string | null
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
          created_at?: string | null
          currency?: string | null
          date?: string
          expense_type?: string | null
          id?: string
          notes?: string | null
          source?: string
          status?: string
          tx_date?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "monthly_budget_tracking"
            referencedColumns: ["budget_category_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_baselines: {
        Row: {
          avg_amount: number
          category: string
          created_at: string | null
          id: string
          months_back: number
          user_id: string
        }
        Insert: {
          avg_amount: number
          category: string
          created_at?: string | null
          id?: string
          months_back: number
          user_id: string
        }
        Update: {
          avg_amount?: number
          category?: string
          created_at?: string | null
          id?: string
          months_back?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_baselines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_expenses: {
        Row: {
          category_group: string | null
          created_at: string | null
          expense_type: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          category_group?: string | null
          created_at?: string | null
          expense_type: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          category_group?: string | null
          created_at?: string | null
          expense_type?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_data_sections: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          data: Json | null
          id: string
          section_type: string
          subsection: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          section_type: string
          subsection: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          section_type?: string
          subsection?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_financial_profile: {
        Row: {
          additional_income: number | null
          afterschool: number | null
          age: number | null
          babysitter: number | null
          bank_loans: number | null
          building_maintenance: number | null
          car_insurance: number | null
          cellular: number | null
          children_ages: number[] | null
          children_count: number | null
          city: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          credit_card_debt: number | null
          current_account_balance: number | null
          current_savings: number | null
          daycare: number | null
          digital_services: number | null
          education: number | null
          electricity: number | null
          extracurricular: number | null
          fuel: number | null
          gas: number | null
          gym: number | null
          health_insurance: number | null
          home_insurance: number | null
          id: string
          insurance: number | null
          internet: number | null
          investments: number | null
          leasing: number | null
          life_insurance: number | null
          long_term_dream: string | null
          marital_status: string | null
          medication: number | null
          monthly_income: number | null
          other_assets: string | null
          other_debts: number | null
          other_fixed: number | null
          owns_car: boolean | null
          owns_home: boolean | null
          parking: number | null
          pension_funds: number | null
          property_tax: number | null
          public_transport: number | null
          rent_mortgage: number | null
          short_term_goal: string | null
          spouse_income: number | null
          streaming: number | null
          subscriptions: number | null
          therapy: number | null
          total_debt: number | null
          total_fixed_expenses: number | null
          total_monthly_income: number | null
          tuition: number | null
          tv_cable: number | null
          updated_at: string | null
          user_id: string
          water: number | null
          why_here: string[] | null
        }
        Insert: {
          additional_income?: number | null
          afterschool?: number | null
          age?: number | null
          babysitter?: number | null
          bank_loans?: number | null
          building_maintenance?: number | null
          car_insurance?: number | null
          cellular?: number | null
          children_ages?: number[] | null
          children_count?: number | null
          city?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          credit_card_debt?: number | null
          current_account_balance?: number | null
          current_savings?: number | null
          daycare?: number | null
          digital_services?: number | null
          education?: number | null
          electricity?: number | null
          extracurricular?: number | null
          fuel?: number | null
          gas?: number | null
          gym?: number | null
          health_insurance?: number | null
          home_insurance?: number | null
          id?: string
          insurance?: number | null
          internet?: number | null
          investments?: number | null
          leasing?: number | null
          life_insurance?: number | null
          long_term_dream?: string | null
          marital_status?: string | null
          medication?: number | null
          monthly_income?: number | null
          other_assets?: string | null
          other_debts?: number | null
          other_fixed?: number | null
          owns_car?: boolean | null
          owns_home?: boolean | null
          parking?: number | null
          pension_funds?: number | null
          property_tax?: number | null
          public_transport?: number | null
          rent_mortgage?: number | null
          short_term_goal?: string | null
          spouse_income?: number | null
          streaming?: number | null
          subscriptions?: number | null
          therapy?: number | null
          total_debt?: number | null
          total_fixed_expenses?: number | null
          total_monthly_income?: number | null
          tuition?: number | null
          tv_cable?: number | null
          updated_at?: string | null
          user_id: string
          water?: number | null
          why_here?: string[] | null
        }
        Update: {
          additional_income?: number | null
          afterschool?: number | null
          age?: number | null
          babysitter?: number | null
          bank_loans?: number | null
          building_maintenance?: number | null
          car_insurance?: number | null
          cellular?: number | null
          children_ages?: number[] | null
          children_count?: number | null
          city?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          credit_card_debt?: number | null
          current_account_balance?: number | null
          current_savings?: number | null
          daycare?: number | null
          digital_services?: number | null
          education?: number | null
          electricity?: number | null
          extracurricular?: number | null
          fuel?: number | null
          gas?: number | null
          gym?: number | null
          health_insurance?: number | null
          home_insurance?: number | null
          id?: string
          insurance?: number | null
          internet?: number | null
          investments?: number | null
          leasing?: number | null
          life_insurance?: number | null
          long_term_dream?: string | null
          marital_status?: string | null
          medication?: number | null
          monthly_income?: number | null
          other_assets?: string | null
          other_debts?: number | null
          other_fixed?: number | null
          owns_car?: boolean | null
          owns_home?: boolean | null
          parking?: number | null
          pension_funds?: number | null
          property_tax?: number | null
          public_transport?: number | null
          rent_mortgage?: number | null
          short_term_goal?: string | null
          spouse_income?: number | null
          streaming?: number | null
          subscriptions?: number | null
          therapy?: number | null
          total_debt?: number | null
          total_fixed_expenses?: number | null
          total_monthly_income?: number | null
          tuition?: number | null
          tv_cable?: number | null
          updated_at?: string | null
          user_id?: string
          water?: number | null
          why_here?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_financial_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_financial_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_financial_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_financial_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_financial_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          budget_alerts: boolean | null
          created_at: string | null
          currency: string | null
          daily_summary: boolean | null
          email_notifications: boolean | null
          goal_reminders: boolean | null
          id: string
          language: string | null
          notifications_enabled: boolean | null
          preferences: Json | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          wa_notifications: boolean | null
          weekly_report: boolean | null
        }
        Insert: {
          budget_alerts?: boolean | null
          created_at?: string | null
          currency?: string | null
          daily_summary?: boolean | null
          email_notifications?: boolean | null
          goal_reminders?: boolean | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          preferences?: Json | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          wa_notifications?: boolean | null
          weekly_report?: boolean | null
        }
        Update: {
          budget_alerts?: boolean | null
          created_at?: string | null
          currency?: string | null
          daily_summary?: boolean | null
          email_notifications?: boolean | null
          goal_reminders?: boolean | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          preferences?: Json | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          wa_notifications?: boolean | null
          weekly_report?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      wa_messages: {
        Row: {
          created_at: string | null
          direction: string
          id: string
          msg_type: string
          payload: Json
          provider_msg_id: string | null
          status: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          direction: string
          id?: string
          msg_type: string
          payload: Json
          provider_msg_id?: string | null
          status?: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          direction?: string
          id?: string
          msg_type?: string
          payload?: Json
          provider_msg_id?: string | null
          status?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wa_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_users_stats: {
        Row: {
          active_subscribers: number | null
          new_users: number | null
          signup_date: string | null
          wa_opted_in: number | null
        }
        Relationships: []
      }
      cash_flow_projection: {
        Row: {
          monthly_in: number | null
          monthly_out_fixed: number | null
          monthly_out_insurance: number | null
          monthly_out_loans: number | null
          monthly_out_savings: number | null
          net_monthly_cash_flow: number | null
          projected_12_months: number | null
          projected_6_months: number | null
          total_monthly_out: number | null
          user_id: string | null
        }
        Relationships: []
      }
      category_spending_report: {
        Row: {
          avg_expense: number | null
          category: string | null
          max_expense: number | null
          month: string | null
          total_expenses: number | null
          transaction_count: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_analysis: {
        Row: {
          average_interest_rate: number | null
          avg_months_to_payoff: number | null
          credit_card_debt: number | null
          debt_to_income_ratio: number | null
          grand_total_debt: number | null
          profile_bank_loans: number | null
          profile_other_debts: number | null
          total_active_loans: number | null
          total_loan_balance: number | null
          total_monthly_payments: number | null
          total_original_amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
      financial_summary: {
        Row: {
          available_monthly: number | null
          current_savings: number | null
          email: string | null
          fixed_expenses: number | null
          insurance_annual_total: number | null
          insurance_monthly_total: number | null
          investments: number | null
          last_updated: string | null
          monthly_income: number | null
          net_worth: number | null
          pension_total: number | null
          savings_accounts_total: number | null
          total_debt: number | null
          total_loans: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      goals_progress_report: {
        Row: {
          amount_remaining: number | null
          current_amount: number | null
          days_remaining: number | null
          deadline: string | null
          goal_name: string | null
          progress_percentage: number | null
          status: string | null
          target_amount: number | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budget_tracking: {
        Row: {
          budget_category_id: string | null
          category_name: string | null
          color: string | null
          current_spent: number | null
          monthly_cap: number | null
          remaining: number | null
          usage_percentage: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "budget_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_data_collection_progress: {
        Row: {
          completed_sections: number | null
          completion_percentage: number | null
          total_sections: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_loan_applications_summary: {
        Row: {
          applicant_email: string | null
          applicant_id_number: string | null
          applicant_name: string | null
          applicant_phone: string | null
          application_type: string | null
          business_name: string | null
          business_number: string | null
          completed_steps: Json | null
          created_at: string | null
          employment_type: string | null
          gadi_notes: string | null
          id: string | null
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
          status: string | null
          submitted_at: string | null
          total_documents: number | null
          updated_at: string | null
          user_id: string | null
          verified_documents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "cash_flow_projection"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "debt_analysis"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_monthly_stats"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loan_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_loan_summary: {
        Row: {
          consumer_debt: number | null
          mortgage_debt: number | null
          total_debt: number | null
          total_loans: number | null
          total_monthly_payment: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_monthly_stats: {
        Row: {
          active_days: number | null
          expense_count: number | null
          income_count: number | null
          month: string | null
          name: string | null
          net_balance: number | null
          total_expenses: number | null
          total_income: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_total_income: {
        Row: {
          employee_income: number | null
          passive_income: number | null
          self_employed_income: number | null
          sources_count: number | null
          total_gross: number | null
          total_net: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_age: {
        Args: { birth_date: string }
        Returns: number
      }
      calculate_financial_health: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_loan_details: {
        Args: { p_loan_id: string }
        Returns: {
          current_balance: number
          interest_rate: number
          loan_id: string
          monthly_payment: number
          months_remaining: number
          original_amount: number
          total_amount_to_pay: number
          total_interest_paid: number
          total_paid: number
        }[]
      }
      calculate_net_worth: {
        Args: { p_user_id?: string }
        Returns: {
          debt_total: number
          investments_total: number
          loans_total: number
          net_worth: number
          pension_total: number
          savings_total: number
          total_assets: number
          total_liabilities: number
          user_id: string
        }[]
      }
      create_default_user_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_daily_summary: {
        Args: { p_date?: string; p_user_id: string }
        Returns: {
          budget_status: string
          top_category: string
          total_expenses: number
          total_income: number
          transaction_count: number
        }[]
      }
      get_inactive_users: {
        Args: { p_days?: number }
        Returns: {
          days_since_activity: number
          email: string
          last_transaction_date: string
          user_id: string
          user_name: string
        }[]
      }
      get_top_spenders: {
        Args: { p_limit?: number; p_month?: string }
        Returns: {
          avg_transaction: number
          total_spent: number
          transaction_count: number
          user_id: string
          user_name: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
