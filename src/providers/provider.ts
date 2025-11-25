import { CertificateRecord } from '../models/certificate';

export interface ProviderCheckpoint {
  /** Provider-specific cursor (e.g., page number or slot) */
  cursor?: number;
  lastTxHash?: string;
}

export interface ProviderEvent {
  txHash: string;
  blockHeight: number;
  slot: number;
  metadataKey: number;
  payload: unknown;
  provider: string;
  observedAt: string;
}

export interface ProviderClient {
  name: string;
  pullSince(checkpoint?: ProviderCheckpoint): Promise<ProviderEvent[]>;
}

export interface CertificateStore {
  upsertCertificate(record: CertificateRecord): Promise<void>;
  getCertificates(filters?: Record<string, unknown>): Promise<CertificateRecord[]>;
}
