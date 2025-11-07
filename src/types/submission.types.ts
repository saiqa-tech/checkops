export interface Submission {
  id: string;
  formId: string;
  data: Record<string, any>;
  status: SubmissionStatus;
  submittedBy?: string;
  submittedAt: Date;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionData {
  [fieldName: string]: any;
}

export interface SubmissionFilter {
  formId?: string;
  status?: SubmissionStatus;
  submittedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
}

export interface SubmissionStats {
  total: number;
  pending: number;
  processed: number;
  failed: number;
  averageProcessingTime?: number;
}

export type SubmissionStatus = 
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'cancelled';