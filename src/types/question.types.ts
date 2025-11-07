export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  questionBankId: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  required: boolean;
  validation?: ValidationRule[];
  order: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionOption {
  id: string;
  questionId: string;
  value: string;
  label: string;
  order: number;
}

export interface ValidationRule {
  type: 'required' | 'min_length' | 'max_length' | 'pattern' | 'custom';
  parameters: Record<string, any>;
  errorMessage?: string;
}

export type QuestionType = 
  | 'multiple_choice'
  | 'single_choice'
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'file'
  | 'url';