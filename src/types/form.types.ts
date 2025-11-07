export interface Form {
  id: string;
  title: string;
  description?: string;
  schema: FormSchema;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormSchema {
  id: string;
  version?: string;
  fields: FormField[];
  metadata?: Record<string, any>;
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: FormFieldOption[];
  validation?: ValidationRule[];
  order: number;
  defaultValue?: any;
}

export interface FormFieldOption {
  value: string;
  label: string;
  order?: number;
}

export interface ValidationRule {
  type: 'required' | 'min_length' | 'max_length' | 'pattern' | 'email' | 'number_range' | 'custom';
  parameters: Record<string, any>;
  errorMessage?: string;
}

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'file'
  | 'url'
  | 'phone';