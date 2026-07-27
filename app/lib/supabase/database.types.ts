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
        profiles: {
          Row: {
            id: string
            full_name: string | null
            role: UserRole
            employee_index: string | null
            contact_no: string | null
            address: string | null
            is_active: boolean
            status_reason: string | null
            status_changed_at: string | null
            status_changed_by: string | null
            created_at: string
          }
          Insert: {
            id: string
            full_name?: string | null
            role?: UserRole
            employee_index?: string | null
            contact_no?: string | null
            address?: string | null
            is_active?: boolean
            status_reason?: string | null
            status_changed_at?: string | null
            status_changed_by?: string | null
            created_at?: string
          }
          Update: {
            full_name?: string | null
            role?: UserRole
            employee_index?: string | null
            contact_no?: string | null
            address?: string | null
            is_active?: boolean
            status_reason?: string | null
            status_changed_at?: string | null
            status_changed_by?: string | null
          }
        Relationships: []
      }
      students: {
        Row: {
          student_id: number
          user_id: string | null
          full_name: string
          index_no: string
          faculty: string | null
          academic_year: string | null
          dob: string | null
            gender: string | null
            contact_no: string | null
            address: string | null
            created_at: string
        }
        Insert: {
          student_id?: number
          user_id?: string | null
          full_name: string
          index_no: string
          faculty?: string | null
          academic_year?: string | null
          dob?: string | null
            gender?: string | null
            contact_no?: string | null
            address?: string | null
            created_at?: string
        }
        Update: {
          user_id?: string | null
          full_name?: string
          index_no?: string
          faculty?: string | null
          academic_year?: string | null
          dob?: string | null
            gender?: string | null
            contact_no?: string | null
            address?: string | null
          }
        Relationships: [
          {
            foreignKeyName: 'students_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      doctors: {
        Row: {
          doctor_id: number
          user_id: string
          full_name: string
          specialisation: string | null
          created_at: string
        }
        Insert: {
          doctor_id?: number
          user_id: string
          full_name: string
          specialisation?: string | null
          created_at?: string
        }
        Update: {
          full_name?: string
          specialisation?: string | null
        }
        Relationships: []
      }
      doctor_availability: {
        Row: {
          availability_id: number
          doctor_id: number
          day_of_week: string
          start_time: string
          end_time: string
          is_available: boolean
        }
        Insert: {
          availability_id?: number
          doctor_id: number
          day_of_week: string
          start_time: string
          end_time: string
          is_available?: boolean
        }
        Update: {
          day_of_week?: string
          start_time?: string
          end_time?: string
          is_available?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'doctor_availability_doctor_id_fkey'
            columns: ['doctor_id']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['doctor_id']
          },
        ]
      }
      medical_records: {
        Row: {
          record_id: number
          student_id: number
          purpose: string
          description: string | null
          issue_date: string
          status: RecordStatus
          submitted_by: string
          reviewed_by: number | null
          rejection_reason: string | null
          diagnosis: string | null
          observation_notes: string | null
          recommendation: string | null
          lifecycle_status: RecordLifecycleStatus
          lifecycle_reason: string | null
          lifecycle_changed_at: string | null
          lifecycle_changed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          record_id?: number
          student_id: number
          purpose: string
          description?: string | null
          issue_date: string
          status?: RecordStatus
          submitted_by?: string
          reviewed_by?: number | null
          rejection_reason?: string | null
          diagnosis?: string | null
          observation_notes?: string | null
          recommendation?: string | null
          lifecycle_status?: RecordLifecycleStatus
          lifecycle_reason?: string | null
          lifecycle_changed_at?: string | null
          lifecycle_changed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          purpose?: string
          description?: string | null
          issue_date?: string
          status?: RecordStatus
          reviewed_by?: number | null
          rejection_reason?: string | null
          diagnosis?: string | null
          observation_notes?: string | null
          recommendation?: string | null
          lifecycle_status?: RecordLifecycleStatus
          lifecycle_reason?: string | null
          lifecycle_changed_at?: string | null
          lifecycle_changed_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'medical_records_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['student_id']
          },
          {
            foreignKeyName: 'medical_records_reviewed_by_fkey'
            columns: ['reviewed_by']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['doctor_id']
          },
        ]
      }
      record_images: {
        Row: {
          image_id: number
          record_id: number
          file_path: string
          file_type: string
          file_size_kb: number
          disposal_status: DocumentDisposalStatus
          disposal_reason: string | null
          disposed_at: string | null
          disposed_by: string | null
          created_at: string
        }
        Insert: {
          image_id?: number
          record_id: number
          file_path: string
          file_type: string
          file_size_kb: number
          disposal_status?: DocumentDisposalStatus
          disposal_reason?: string | null
          disposed_at?: string | null
          disposed_by?: string | null
          created_at?: string
        }
        Update: {
          file_path?: string
          file_type?: string
          file_size_kb?: number
          disposal_status?: DocumentDisposalStatus
          disposal_reason?: string | null
          disposed_at?: string | null
          disposed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'record_images_record_id_fkey'
            columns: ['record_id']
            isOneToOne: false
            referencedRelation: 'medical_records'
            referencedColumns: ['record_id']
          },
        ]
      }
      medical_visits: {
        Row: {
          visit_id: number
          doctor_id: number
          user_id: string
          visit_date: string
          reason: string
          notes: string | null
          status: string
          patient_name: string
          patient_index: string
          patient_type: PatientType
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          visit_id?: number
          doctor_id: number
          user_id: string
          visit_date: string
          reason: string
          notes?: string | null
          status?: string
          patient_name: string
          patient_index: string
          patient_type: PatientType
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          visit_date?: string
          reason?: string
          notes?: string | null
          status?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'medical_visits_doctor_id_fkey'
            columns: ['doctor_id']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['doctor_id']
          },
        ]
      }
      notifications: {
        Row: {
          notification_id: number
          user_id: string
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          notification_id?: number
          user_id: string
          title: string
          message: string
          type?: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          is_read?: boolean
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          audit_id: number
          action: string
          table_name: string
          record_id: string | null
          user_id: string | null
          old_data: Json | null
          new_data: Json | null
          performed_at: string
        }
        Insert: {
          audit_id?: number
          action: string
          table_name: string
          record_id?: string | null
          user_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          performed_at?: string
        }
        Update: never
        Relationships: []
      }
      medical_record_reviews: {
        Row: {
          review_id: number
          record_id: number
          doctor_id: number
          from_status: RecordStatus
          to_status: RecordStatus
          diagnosis: string | null
          observation_notes: string | null
          recommendation: string | null
          rejection_reason: string | null
          reversal_reason: string | null
          reviewed_at: string
        }
        Insert: {
          review_id?: number
          record_id: number
          doctor_id: number
          from_status: RecordStatus
          to_status: RecordStatus
          diagnosis?: string | null
          observation_notes?: string | null
          recommendation?: string | null
          rejection_reason?: string | null
          reversal_reason?: string | null
          reviewed_at?: string
        }
        Update: never
        Relationships: [
          {
            foreignKeyName: 'medical_record_reviews_record_id_fkey'
            columns: ['record_id']
            isOneToOne: false
            referencedRelation: 'medical_records'
            referencedColumns: ['record_id']
          },
          {
            foreignKeyName: 'medical_record_reviews_doctor_id_fkey'
            columns: ['doctor_id']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['doctor_id']
          },
        ]
      }
      account_status_history: {
        Row: {
          history_id: number
          user_id: string
          previous_status: AccountLifecycleStatus
          new_status: AccountLifecycleStatus
          reason: string
          changed_by: string
          changed_at: string
        }
        Insert: {
          history_id?: number
          user_id: string
          previous_status: AccountLifecycleStatus
          new_status: AccountLifecycleStatus
          reason: string
          changed_by: string
          changed_at?: string
        }
        Update: never
        Relationships: []
      }
      medical_record_lifecycle_history: {
        Row: {
          history_id: number
          record_id: number
          previous_status: RecordLifecycleStatus
          new_status: RecordLifecycleStatus
          reason: string
          changed_by: string
          changed_at: string
        }
        Insert: {
          history_id?: number
          record_id: number
          previous_status: RecordLifecycleStatus
          new_status: RecordLifecycleStatus
          reason: string
          changed_by: string
          changed_at?: string
        }
        Update: never
        Relationships: [
          {
            foreignKeyName: 'medical_record_lifecycle_history_record_id_fkey'
            columns: ['record_id']
            isOneToOne: false
            referencedRelation: 'medical_records'
            referencedColumns: ['record_id']
          },
        ]
      }
      onboarding_imports: {
        Row: {
          job_id: string
          import_type: ImportType
          source_file: string | null
          status: ImportJobStatus
          total_rows: number
          successful_rows: number
          failed_rows: number
          skipped_rows: number
          created_by: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          job_id?: string
          import_type: ImportType
          source_file?: string | null
          status?: ImportJobStatus
          total_rows?: number
          successful_rows?: number
          failed_rows?: number
          skipped_rows?: number
          created_by: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          status?: ImportJobStatus
          successful_rows?: number
          failed_rows?: number
          skipped_rows?: number
          completed_at?: string | null
        }
        Relationships: []
      }
      onboarding_import_rows: {
        Row: {
          row_id: number
          job_id: string
          row_number: number
          email: string
          identifier: string
          payload: Json
          status: ImportRowStatus
          error_message: string | null
          auth_user_id: string | null
          attempt_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          row_id?: number
          job_id: string
          row_number: number
          email: string
          identifier: string
          payload: Json
          status?: ImportRowStatus
          error_message?: string | null
          auth_user_id?: string | null
          attempt_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: ImportRowStatus
          error_message?: string | null
          auth_user_id?: string | null
          attempt_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'onboarding_import_rows_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'onboarding_imports'
            referencedColumns: ['job_id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      replace_doctor_availability: {
        Args: { p_schedule: Json }
        Returns: undefined
      }
      review_medical_record: {
        Args: {
          p_record_id: number
          p_expected_status: RecordStatus
          p_new_status: Exclude<RecordStatus, 'pending'>
          p_diagnosis: string | null
          p_observation_notes: string | null
          p_recommendation: string | null
          p_rejection_reason: string | null
          p_reversal_reason: string | null
        }
        Returns: undefined
      }
      admin_update_user_profile: {
        Args: {
          p_actor_id: string
          p_user_id: string
          p_full_name: string
          p_role: UserRole
          p_identifier: string | null
        }
        Returns: undefined
      }
      admin_set_account_status: {
        Args: {
          p_actor_id: string
          p_user_id: string
          p_is_active: boolean
          p_reason: string
        }
        Returns: undefined
      }
      admin_change_medical_record_lifecycle: {
        Args: {
          p_actor_id: string
          p_record_id: number
          p_new_status: RecordLifecycleStatus
          p_reason: string
        }
        Returns: undefined
      }
      void_medical_visit: {
        Args: {
          p_actor_id: string
          p_visit_id: number
          p_reason: string
        }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type UserRole = 'student' | 'doctor' | 'worker' | 'faculty' | 'admin' | 'unassigned'
export type RecordStatus = 'pending' | 'approved' | 'rejected'
export type RecordLifecycleStatus = 'active' | 'archived' | 'invalidated'
export type AccountLifecycleStatus = 'active' | 'inactive'
export type DocumentDisposalStatus = 'retained' | 'disposal_pending' | 'disposed'
export type PatientType = 'Student' | 'Employee'
export type ImportType = 'students' | 'personnel'
export type ImportJobStatus = 'processing' | 'completed' | 'partial' | 'failed'
export type ImportRowStatus = 'pending' | 'invited' | 'skipped' | 'failed'

export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
