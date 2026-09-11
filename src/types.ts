/**
 * CloudBase Digital Feedback Box Types
 * Multi-tenant architecture matching Cloudflare D1 database schema
 */

export type SubmissionType = 'suggestion' | 'complaint';

export type SuggestionStatus =
  | 'New'
  | 'Reviewing'
  | 'Accepted'
  | 'In Progress'
  | 'Implemented'
  | 'Rejected'
  | 'Closed';

export type ComplaintStatus =
  | 'New'
  | 'Under Review'
  | 'Investigating'
  | 'Action Taken'
  | 'Resolved'
  | 'Closed';

export type SubmissionStatus = SuggestionStatus | ComplaintStatus;

export interface Organization {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'inactive';
  contact_email?: string;
  welcome_message?: string;
  thank_you_message?: string;
  created_at: string;
  updated_at: string;
}

export interface FeedbackBox {
  id: string;
  organization_id: string;
  box_code: string;
  title: string;
  description: string;
  public_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Operator {
  id: string;
  organization_id: string;
  username: string;
  role: 'admin' | 'operator';
  status: 'active' | 'inactive';
  created_at: string;
  last_login_at?: string;
}

export interface Submission {
  id: string;
  organization_id: string;
  feedback_box_id: string;
  feedback_box_title?: string;
  feedback_box_code?: string;
  type: SubmissionType;
  message: string;
  submitter_name?: string;
  submitter_contact?: string;
  is_anonymous: boolean;
  device_token_hash: string;
  security_hash?: string;
  message_hash?: string;
  status: SubmissionStatus;
  submitted_at: string;
  updated_at: string;
  // Computed fields
  duplicate_count?: number;
  estimated_devices_count?: number;
  group_id?: string | null;
  group_title?: string | null;
  notes_count?: number;
}

export interface FeedbackGroup {
  id: string;
  organization_id: string;
  feedback_box_id?: string;
  type: SubmissionType;
  title: string;
  description?: string;
  status: 'Active' | 'Under Review' | 'Resolved' | 'Archived';
  created_at: string;
  updated_at: string;
  submission_count: number;
  estimated_devices: number;
  sample_messages?: string[];
}

export interface SubmissionGroupMember {
  id: string;
  submission_id: string;
  group_id: string;
  created_at: string;
}

export interface FeedbackNote {
  id: string;
  submission_id: string;
  operator_id: string;
  operator_name: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  id: string;
  organization_id: string;
  report_date: string;
  status: 'sent' | 'failed' | 'generated';
  sent_at?: string;
  error_message?: string | null;
  created_at: string;
  report_payload: {
    organization_name: string;
    report_date: string;
    total_suggestions: number;
    top_suggestions: Array<{
      text: string;
      submissions_count: number;
      estimated_devices: number;
    }>;
    total_complaints: number;
    complaints_status_counts: Record<string, number>;
    recent_complaints: string[];
    recipient_email?: string;
  };
}

export interface StatisticsData {
  total_feedback: number;
  total_suggestions: number;
  total_complaints: number;
  today_feedback: number;
  estimated_unique_devices: number;
  anonymous_percentage: number;
  suggestion_status_counts: Record<string, number>;
  complaint_status_counts: Record<string, number>;
  top_repeated_suggestions: Array<{
    message: string;
    count: number;
    estimated_devices: number;
    group_title?: string;
  }>;
  top_repeated_complaints: Array<{
    message: string;
    count: number;
    estimated_devices: number;
    group_title?: string;
  }>;
  boxes_breakdown: Array<{
    box_code: string;
    title: string;
    total: number;
    suggestions: number;
    complaints: number;
  }>;
}

export interface PublicSubmissionPayload {
  box_code: string;
  type: SubmissionType;
  message: string;
  name?: string;
  contact?: string;
  anonymous: boolean;
  device_token: string;
}
