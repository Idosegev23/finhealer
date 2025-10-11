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
          category: string
          category_id: string | null
          created_at: string | null
          currency: string | null
          date: string
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
          category: string
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
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
          category?: string
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          date?: string
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
    }
    Functions: {
      calculate_financial_health: {
        Args: { p_user_id: string }
        Returns: number
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
