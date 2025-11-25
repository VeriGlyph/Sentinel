import { validateCip88, verifyCip88Signatures } from '../lib/cip88';
import { CertificateRecord, CertificateStatus } from '../models/certificate';
import { ProviderEvent } from '../providers/provider';
import { InMemoryCertificateStore } from './certificate-service';
import { PgCertificateStore } from './db';

export interface IngestionResult {
  record: CertificateRecord;
  ok: boolean;
}

function determineCertificateType(version: number, scopeType: string): string {
  if (version === 2 && scopeType === 'stake_pool') return 'cip-151';
  return 'cip-88';
}

function normalizeMetadata(event: ProviderEvent): unknown {
  if (event.metadataKey === 867) {
    // Some providers may hand us only the registration object; wrap it under 867 if needed
    if (event.payload && typeof event.payload === 'object' && !(event.payload as Record<string, unknown>)[867]) {
      return { 867: event.payload };
    }
  }
  return event.payload;
}

export async function ingestProviderEvents(
  events: ProviderEvent[],
  store: InMemoryCertificateStore | PgCertificateStore
): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];

  for (const event of events) {
    const metadata = normalizeMetadata(event);
    const validation = validateCip88(metadata);

    let status: CertificateStatus = validation.ok
      ? 'valid'
      : validation.errors.some((e) => e.toLowerCase().includes('unsupported scope'))
      ? 'unparsed'
      : 'invalid';

    let signatureValid = false;
    let signatureErrors: string[] | undefined;
    let signatureVerifiedBy: string[] | undefined;
    const ingestionErrors: string[] = validation.ok ? [] : [...validation.errors];

    if (validation.ok && validation.data && validation.registrationRaw) {
      // Nonce replay protection
      const scopeId = validation.data.scope.policyId ?? validation.data.scope.poolId;
      const incomingNonce = validation.data.nonce;
      if (scopeId && incomingNonce !== undefined) {
        const maxNonce =
          'getMaxNonce' in store && typeof store.getMaxNonce === 'function'
            ? await (store as any).getMaxNonce(scopeId)
            : undefined;
        if (maxNonce !== undefined && incomingNonce <= maxNonce) {
          status = 'invalid';
          ingestionErrors.push(`nonce ${incomingNonce} not greater than existing max ${maxNonce}`);
        }
      }

      const sigResult = verifyCip88Signatures(validation.registrationRaw, validation.data);
      signatureValid = sigResult.status === 'valid';
      signatureErrors = sigResult.errors.length ? sigResult.errors : undefined;
      signatureVerifiedBy = sigResult.verifiedBy;

      if (sigResult.status === 'invalid') {
        status = 'invalid';
        ingestionErrors.push(...(sigResult.errors || []));
      } else if (sigResult.status === 'unsupported' && status === 'valid') {
        status = 'unparsed';
      }
    }

    const scopeType = validation.data?.scope.scopeType === 'stake_pool' ? 'pool' : 'policy';
    const scopeId = validation.data?.scope.policyId ?? validation.data?.scope.poolId;

    const certificateType = validation.data
      ? determineCertificateType(validation.data.version, validation.data.scope.scopeType)
      : 'unknown';

    const record: CertificateRecord = {
      id: `${event.txHash}-${event.metadataKey ?? 'unknown'}`,
      txHash: event.txHash,
      blockHeight: event.blockHeight,
      slot: event.slot,
      provider: event.provider,
      metadataKey: event.metadataKey,
      rawPayload: event.payload,
      parsedPayload: validation.data
        ? {
            ...validation.data,
            signatureValid,
            signatureErrors,
            signatureVerifiedBy,
          }
        : undefined,
      certificateType,
      status,
      validationErrors: ingestionErrors.length ? ingestionErrors : undefined,
      observedAt: event.observedAt,
      validatedAt: new Date().toISOString(),
      scopeType,
      scopeId,
      nonce: validation.data?.nonce,
    };

    await store.upsertCertificate(record);
    const ok = record.status === 'valid';
    results.push({ record, ok });
  }

  return results;
}
