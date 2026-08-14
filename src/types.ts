export type PolicyStatus = 'ACTIVE' | 'EXPIRING SOON' | 'EXPIRED';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface FieldConfidence { value: string | number | null; confidence: ConfidenceLevel; note?: string; }
export interface AdditionalDetail { label: string; value: string; confidence?: ConfidenceLevel; }
export interface FieldEvidence { field: string; sourceText: string; }

export interface PolicyRecord {
  id: string;
  ownerName: string;
  policyNumber: string;
  providerCompany: string;
  policyType: string;
  category?: string;
  startDate: string | null;
  endDate: string | null;
  premiumAmount: number | null;
  premiumFrequency: string | null;
  sumAssured: number | null;
  insuredPerson: string | null;
  nominee: string | null;
  nomineeRelationship?: string | null;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
  age?: number | null;
  ageSource?: string | null;
  agentName: string | null;
  agentPhone: string | null;
  branchName?: string | null;
  paymentMode: string | null;
  policyStatus: PolicyStatus;
  maturityDate: string | null;
  documentUrl: string | null;
  originalFileName: string;
  fileSizeBytes?: number;
  fileType?: string;
  extractedText: string;
  aiConfidence: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  additionalDetails: AdditionalDetail[];
  missingFields: string[];
  uncertainFields: string[];
  fieldConfidenceMap?: Record<string, ConfidenceLevel>;
  fieldEvidence?: FieldEvidence[];
  documentType?: string;
  detectedInsurer?: string;
  appliedTemplate?: string;
}

export interface ExtractionResult {
  ownerName: string | null;
  policyNumber: string | null;
  providerCompany: string | null;
  policyType: string | null;
  category?: string;
  startDate: string | null;
  endDate: string | null;
  premiumAmount: number | null;
  premiumFrequency: string | null;
  sumAssured: number | null;
  insuredPerson: string | null;
  nominee: string | null;
  nomineeRelationship?: string | null;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  dateOfBirth: string | null;
  age: number | null;
  ageSource?: string | null;
  agentName: string | null;
  agentPhone: string | null;
  branchName?: string | null;
  paymentMode: string | null;
  policyStatus: PolicyStatus;
  maturityDate: string | null;
  additionalDetails: AdditionalDetail[];
  missingFields: string[];
  uncertainFields: string[];
  confidence: number;
  extractedText: string;
  fieldConfidenceMap: Record<string, ConfidenceLevel>;
  fieldEvidence?: FieldEvidence[];
  documentType?: string;
  detectedInsurer?: string;
  appliedTemplate?: string;
}

export interface AccountantUser { id: string; name: string; email: string; firmName: string; role: string; avatarUrl?: string; }
export interface DashboardStats { totalPolicies: number; activePolicies: number; expiredPolicies: number; expiringSoonPolicies: number; totalPremiumValue: number; policiesAddedThisMonth: number; }
export interface QueueFileItem { id: string; file: File; fileBase64?: string; status: 'pending' | 'analyzing' | 'completed' | 'error'; result?: ExtractionResult; error?: string; }
export interface BatchExtractionItem { id: string; fileName: string; fileType: string; fileBase64?: string; result: ExtractionResult; }
export interface SecurityAuditLog { id: string; timestamp: string; action: string; actor: string; details: string; ipAddress: string; }
