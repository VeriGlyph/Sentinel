import knexFactory, { Knex } from 'knex';
import { CertificateRecord, CertificateStatus } from '../models/certificate';

type CertificateRow = {
  id: string;
  tx_hash: string;
  block_height: number;
  slot: number;
  provider: string;
  metadata_key: number;
  raw_payload: unknown;
  parsed_payload?: unknown;
  certificate_type?: string;
  status: CertificateStatus;
  validation_errors?: string[];
  observed_at: string;
  validated_at?: string;
  scope_type?: string;
  scope_id?: string;
  nonce?: number | string | null;
};

export interface CertificateFilters {
  status?: CertificateStatus;
  type?: string;
  txHash?: string;
  provider?: string;
  scopeId?: string;
}

export class PgCertificateStore {
  private knex: Knex;

  constructor() {
    this.knex = knexFactory({
      client: 'pg',
      connection: process.env.DATABASE_URL || {
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
        user: process.env.DB_USER || 'veriglyph',
        password: process.env.DB_PASSWORD || 'veriglyph',
        database: process.env.DB_NAME || 'veriglyph_indexer',
      },
      migrations: {
        directory: './migrations',
        extension: 'ts',
      },
    });
  }

  async upsertCertificate(record: CertificateRecord): Promise<void> {
    const json = (val: unknown) => (val === undefined ? null : JSON.stringify(val));

    await this.knex('certificates')
      .insert({
        id: record.id,
        tx_hash: record.txHash,
        block_height: record.blockHeight,
        slot: record.slot,
        provider: record.provider,
        metadata_key: record.metadataKey,
        raw_payload: this.knex.raw('?::jsonb', json(record.rawPayload)),
        parsed_payload: record.parsedPayload ? this.knex.raw('?::jsonb', json(record.parsedPayload)) : null,
        certificate_type: record.certificateType,
        status: record.status,
        validation_errors: record.validationErrors
          ? this.knex.raw('?::jsonb', json(record.validationErrors))
          : null,
        signature_valid: (record as any).parsedPayload?.signatureValid ?? null,
        signature_verified_by: (record as any).parsedPayload?.signatureVerifiedBy
          ? this.knex.raw('?::jsonb', json((record as any).parsedPayload?.signatureVerifiedBy))
          : null,
        observed_at: record.observedAt,
        validated_at: record.validatedAt,
        scope_type: record.scopeType ?? null,
        scope_id: record.scopeId ?? null,
        nonce: record.nonce ?? null,
      })
      .onConflict('id')
      .merge({
        block_height: record.blockHeight,
        slot: record.slot,
        provider: record.provider,
        metadata_key: record.metadataKey,
        raw_payload: this.knex.raw('?::jsonb', json(record.rawPayload)),
        parsed_payload: record.parsedPayload ? this.knex.raw('?::jsonb', json(record.parsedPayload)) : null,
        certificate_type: record.certificateType,
        status: record.status,
        validation_errors: record.validationErrors
          ? this.knex.raw('?::jsonb', json(record.validationErrors))
          : null,
        signature_valid: (record as any).parsedPayload?.signatureValid ?? null,
        signature_verified_by: (record as any).parsedPayload?.signatureVerifiedBy
          ? this.knex.raw('?::jsonb', json((record as any).parsedPayload?.signatureVerifiedBy))
          : null,
        observed_at: record.observedAt,
        validated_at: record.validatedAt,
        updated_at: this.knex.fn.now(),
        scope_type: record.scopeType ?? null,
        scope_id: record.scopeId ?? null,
        nonce: record.nonce ?? null,
      });
  }

  async getCertificates(filters: CertificateFilters = {}): Promise<CertificateRecord[]> {
    const rows = (await this.knex('certificates')
      .modify((qb) => {
        if (filters.status) qb.where('status', filters.status);
        if (filters.type) qb.where('certificate_type', filters.type);
        if (filters.txHash) qb.where('tx_hash', filters.txHash);
        if (filters.provider) qb.where('provider', filters.provider);
        if (filters.scopeId) qb.where('scope_id', filters.scopeId);
      })
      .orderBy('observed_at', 'desc')
      .limit(1000)) as CertificateRow[];

    return rows.map((row: CertificateRow) => ({
      id: row.id,
      txHash: row.tx_hash,
      blockHeight: row.block_height,
      slot: row.slot,
      provider: row.provider,
      metadataKey: row.metadata_key,
      rawPayload: row.raw_payload,
      parsedPayload: row.parsed_payload,
      certificateType: row.certificate_type,
      status: row.status,
      validationErrors: row.validation_errors,
      observedAt: row.observed_at,
      validatedAt: row.validated_at,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      nonce: row.nonce ? Number(row.nonce) : undefined,
    }));
  }

  async getMaxNonce(scopeId: string): Promise<number | undefined> {
    const row = (await this.knex('certificates')
      .where({ scope_id: scopeId, status: 'valid' })
      .max('nonce as max')
      .first()) as { max: number | string | null } | undefined;
    return row?.max !== null && row?.max !== undefined ? Number(row.max) : undefined;
  }

  async getLatestCertificate(scopeId: string, slot?: number): Promise<CertificateRecord | undefined> {
    const qb = this.knex('certificates')
      .where({ scope_id: scopeId, status: 'valid' })
      .orderBy([{ column: 'nonce', order: 'desc' }, { column: 'slot', order: 'desc' }]);
    if (slot !== undefined) {
      qb.andWhere('slot', '<=', slot);
    }
    const row = (await qb.first()) as CertificateRow | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      txHash: row.tx_hash,
      blockHeight: row.block_height,
      slot: row.slot,
      provider: row.provider,
      metadataKey: row.metadata_key,
      rawPayload: row.raw_payload,
      parsedPayload: row.parsed_payload,
      certificateType: row.certificate_type,
      status: row.status,
      validationErrors: row.validation_errors,
      observedAt: row.observed_at,
      validatedAt: row.validated_at,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      nonce: row.nonce ? Number(row.nonce) : undefined,
    };
  }

  async getCheckpoint(provider: string): Promise<{ cursor: number; lastTxHash?: string } | undefined> {
    const row = await this.knex('provider_checkpoints').where('provider', provider).first();
    if (!row) return undefined;
    return { cursor: row.cursor, lastTxHash: row.last_tx_hash };
  }

  async setCheckpoint(provider: string, cursor: number, lastTxHash?: string): Promise<void> {
    await this.knex('provider_checkpoints')
      .insert({ provider, cursor, last_tx_hash: lastTxHash })
      .onConflict('provider')
      .merge({ cursor, last_tx_hash: lastTxHash, updated_at: this.knex.fn.now() });
  }
}
