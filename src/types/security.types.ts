export interface ApiKey {
  id: string;
  keyHash: string;
  name: string;
  permissions: Permission[];
  isActive: boolean;
  rateLimitPerHour: number;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: Permission[];
  rateLimitPerHour?: number;
  expiresAt?: Date;
  createdBy: string;
}

export interface AuthenticateRequest {
  apiKey: string;
}

export interface AuthenticateResult {
  isValid: boolean;
  apiKey?: ApiKey;
  errorMessage?: string;
}

export interface PermissionCheck {
  hasPermission: boolean;
  apiKey?: ApiKey;
  errorMessage?: string;
}

export type Permission = 
  | '*' // All permissions
  | 'forms:read'
  | 'forms:create'
  | 'forms:update'
  | 'forms:delete'
  | 'questions:read'
  | 'questions:create'
  | 'questions:update'
  | 'questions:delete'
  | 'submissions:read'
  | 'submissions:create'
  | 'submissions:update'
  | 'submissions:delete'
  | 'submissions:process'
  | 'api_keys:read'
  | 'api_keys:create'
  | 'api_keys:update'
  | 'api_keys:delete'
  | 'analytics:read'
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete';