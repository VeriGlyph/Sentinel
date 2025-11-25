export type CertificateStatus = 'valid' | 'invalid' | 'unparsed';

export interface CertificateRecord {
  id: string;
  txHash: string;
  blockHeight: number;
  slot: number;
  provider: string;
  metadataKey: number;
  rawPayload: unknown;
  parsedPayload?: unknown;
  certificateType?: string;
  status: CertificateStatus;
  validationErrors?: string[];
  observedAt: string;
  validatedAt?: string;
  scopeType?: string;
  scopeId?: string;
  nonce?: number;
}
