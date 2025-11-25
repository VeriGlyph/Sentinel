import cbor from 'cbor';
import { validateCip88, verifyCip88Signatures, getHash } from '../lib/cip88';
import { CertificateRecord, CertificateStatus } from '../models/certificate';
import { ProviderEvent } from '../providers/provider';
import { InMemoryCertificateStore } from './certificate-service';
import { PgCertificateStore } from './db';
import { isHex, normalizeHex } from '../lib/hex';

export interface IngestionResult {
  record: CertificateRecord;
  ok: boolean;
}

export interface NativeScriptResolver {
  fetchNativeScript(policyId: string): Promise<unknown | null>;
}

function determineCertificateType(version: number, scopeType: string): string {
  if (version === 2 && scopeType === 'stake_pool') return 'cip-151';
  return 'cip-88';
}

const normalizePolicyId = (policyId?: string) => (policyId ? normalizeHex(policyId) : undefined);

const tryDecodeCbor = (hex: string): unknown => {
  try {
    return cbor.decode(Buffer.from(normalizeHex(hex), 'hex'));
  } catch {
    return hex;
  }
};

const extractKeyHashes = (script: unknown): string[] => {
  const hashes: string[] = [];
  const visit = (node: unknown) => {
    if (!node && node !== 0) return;
    if (Buffer.isBuffer(node)) {
      hashes.push(node.toString('hex'));
      return;
    }
    if (typeof node === 'string') {
      const norm = normalizeHex(node);
      hashes.push(norm);
      if (isHex(norm)) {
        const decoded = tryDecodeCbor(norm);
        if (decoded !== norm) visit(decoded);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (obj.keyHash && typeof obj.keyHash === 'string') hashes.push(normalizeHex(obj.keyHash));
      if (Array.isArray(obj.scripts)) obj.scripts.forEach(visit);
      Object.values(obj).forEach(visit);
    }
  };
  visit(script);
  return hashes;
};

const containsAnyKeyHash = (scripts: unknown[], targetHashes: string[]): boolean => {
  const targets = targetHashes.map(normalizeHex);
  for (const script of scripts) {
    const hashes = extractKeyHashes(script);
    if (hashes.some((h) => targets.includes(normalizeHex(h)))) {
      return true;
    }
  }
  return false;
};

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
  store: InMemoryCertificateStore | PgCertificateStore,
  options?: { nativeScriptResolver?: NativeScriptResolver }
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
      const scopeIdHex = validation.data.scope.policyId ?? validation.data.scope.poolId;
      const scopeId = scopeIdHex ? normalizeHex(scopeIdHex) : undefined;
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

      if (
        status === 'valid' &&
        validation.data.scope.scopeType === 'native_script' &&
        signatureVerifiedBy?.length
      ) {
        const witnessKeyHashes = signatureVerifiedBy.map((pk) => getHash(normalizeHex(pk), 28));
        const policyId = normalizePolicyId(validation.data.scope.policyId);
        let policyScripts: unknown[] = validation.data.scope.policyScripts ?? [];

        if (!policyScripts.length && policyId && options?.nativeScriptResolver) {
          const fetched = await options.nativeScriptResolver.fetchNativeScript(policyId);
          if (fetched) policyScripts = [fetched];
        }

        if (!policyScripts.length) {
          status = 'unparsed';
          ingestionErrors.push('native script body unavailable for policy verification');
        } else if (!containsAnyKeyHash(policyScripts, witnessKeyHashes)) {
          status = 'invalid';
          ingestionErrors.push('signing key not found in native script policy');
        }
      }
    }

    const scopeType = validation.data?.scope.scopeType === 'stake_pool' ? 'pool' : 'policy';
    const scopeIdHex = validation.data?.scope.policyId ?? validation.data?.scope.poolId;
    const scopeId = scopeIdHex ? normalizeHex(scopeIdHex) : undefined;

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
