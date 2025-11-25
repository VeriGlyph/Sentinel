import { CertificateRecord, CertificateStatus } from '../models/certificate';

export interface CertificateFilters {
  status?: CertificateStatus;
  type?: string;
  txHash?: string;
  provider?: string;
  scopeId?: string;
}

export class InMemoryCertificateStore {
  private store: Map<string, CertificateRecord> = new Map();

  async upsertCertificate(record: CertificateRecord): Promise<void> {
    this.store.set(record.id, record);
  }

  async getCertificates(filters: CertificateFilters = {}): Promise<CertificateRecord[]> {
    return [...this.store.values()].filter((record) => {
      if (filters.status && record.status !== filters.status) return false;
      if (filters.type && record.certificateType !== filters.type) return false;
      if (filters.txHash && record.txHash !== filters.txHash) return false;
      if (filters.provider && record.provider !== filters.provider) return false;
      if (filters.scopeId && record.scopeId !== filters.scopeId) return false;
      return true;
    });
  }

  async getMaxNonce(scopeId: string): Promise<number | undefined> {
    const matching = [...this.store.values()].filter((r) => r.scopeId === scopeId && r.status === 'valid');
    if (!matching.length) return undefined;
    return Math.max(...matching.map((r) => r.nonce ?? 0));
  }

  async getLatestCertificate(scopeId: string, slot?: number): Promise<CertificateRecord | undefined> {
    const matching = [...this.store.values()].filter((r) => r.scopeId === scopeId && r.status === 'valid');
    const filtered = slot !== undefined ? matching.filter((r) => r.slot <= slot) : matching;
    return filtered.sort((a, b) => (b.nonce ?? 0) - (a.nonce ?? 0) || b.slot - a.slot)[0];
  }
}
