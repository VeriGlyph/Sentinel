<template>
  <v-card>
    <v-card-title>Lookup by Transaction</v-card-title>
    <v-card-text>
      <v-row dense>
        <v-col cols="12" md="8">
          <v-text-field
            v-model="tx"
            label="Transaction Hash"
            density="compact"
            clearable
            @keyup.enter="lookup"
          />
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center">
          <v-btn color="primary" class="mr-2" :loading="loading" @click="lookup">Lookup</v-btn>
          <v-btn variant="text" @click="reset">Clear</v-btn>
        </v-col>
      </v-row>
      <div v-if="error" class="text-error mt-2">{{ error }}</div>
      <v-alert v-if="notFound" type="warning" class="mt-4">No certificate found for that transaction.</v-alert>
      <v-card v-if="certificate" class="mt-4" variant="outlined">
        <v-card-title class="d-flex justify-space-between">
          <span>Certificate</span>
          <v-chip :color="statusColor(certificate.status)" size="small" variant="flat">
            {{ certificate.status }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="6">
              <div><strong>TX:</strong> <a :href="txUrl(certificate.txHash)" target="_blank" rel="noreferrer">{{ certificate.txHash }}</a></div>
              <div><strong>Type:</strong> {{ certificate.certificateType ?? 'unknown' }}</div>
              <div><strong>Scope ID:</strong> {{ certificate.scopeId ?? 'n/a' }}</div>
              <div><strong>Nonce:</strong> {{ certificate.nonce ?? 'n/a' }}</div>
            </v-col>
            <v-col cols="12" md="6">
              <div><strong>Provider:</strong> {{ certificate.provider }}</div>
              <div><strong>Observed:</strong> {{ certificate.observedAt }}</div>
              <div><strong>Validated:</strong> {{ certificate.validatedAt ?? 'n/a' }}</div>
            </v-col>
          </v-row>
          <v-divider class="my-3" />
          <v-row dense>
            <v-col cols="12" md="6">
              <div><strong>CIP Version:</strong> {{ parsed?.version ?? 'unknown' }}</div>
              <div><strong>Scope:</strong> {{ parsed?.scope?.scopeType ?? 'unknown' }}</div>
              <div v-if="parsed?.scope?.policyId"><strong>Policy ID:</strong> {{ parsed.scope.policyId }}</div>
              <div v-if="parsed?.scope?.poolId"><strong>Pool ID:</strong> {{ parsed.scope.poolId }}</div>
              <div><strong>Feature Set:</strong> {{ parsed?.featureSet?.join(', ') ?? 'n/a' }}</div>
              <div><strong>Nonce:</strong> {{ parsed?.nonce ?? 'n/a' }}</div>
              <div v-if="parsed?.calidusKey"><strong>Calidus Key:</strong> {{ parsed.calidusKey }}</div>
            </v-col>
            <v-col cols="12" md="6">
              <div><strong>Validation:</strong> {{ validationMethodLabel(parsed?.validation?.method) }}</div>
              <div v-if="parsed?.validation?.context?.length">
                <strong>Validation Context:</strong> {{ parsed.validation.context.join(', ') }}
              </div>
              <div v-if="parsed?.oracleUri?.length"><strong>Oracles:</strong> {{ parsed.oracleUri.join(', ') }}</div>
              <div v-if="parsed?.signatureValid !== undefined">
                <strong>Signature:</strong>
                <v-chip
                  class="ml-1"
                  :color="parsed.signatureValid ? 'green' : 'red'"
                  size="x-small"
                  variant="flat"
                >
                  {{ parsed.signatureValid ? 'valid' : 'invalid' }}
                </v-chip>
              </div>
              <div v-if="parsed?.signatureVerifiedBy?.length">
                <strong>Verified By:</strong> {{ parsed.signatureVerifiedBy.join(', ') }}
              </div>
            </v-col>
          </v-row>
          <div v-if="parsed?.cipDetails" class="mt-2">
            <strong>CIP Details:</strong>
            <pre class="mt-1">{{ formatJson(parsed.cipDetails) }}</pre>
          </div>
          <div v-if="parsed?.witnesses?.length" class="mt-2">
            <strong>Witnesses:</strong>
            <ul class="mt-1">
              <li v-for="(w, idx) in parsed.witnesses" :key="idx">
                {{ w.type !== undefined ? `type ${w.type}` : 'unknown type' }} — pubkey {{ w.publicKey ?? 'n/a' }}
              </li>
            </ul>
          </div>
          <div v-if="certificate.validationErrors?.length" class="mt-2 text-error">
            <div><strong>Errors:</strong></div>
            <ul>
              <li v-for="err in certificate.validationErrors" :key="err">{{ err }}</li>
            </ul>
          </div>
          <v-expansion-panels class="mt-3" multiple>
            <v-expansion-panel v-if="certificate.parsedPayload">
              <v-expansion-panel-title>Parsed payload</v-expansion-panel-title>
              <v-expansion-panel-text>
                <pre>{{ formatJson(certificate.parsedPayload) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
            <v-expansion-panel v-if="certificate.rawPayload">
              <v-expansion-panel-title>Raw metadata payload</v-expansion-panel-title>
              <v-expansion-panel-text>
                <pre>{{ formatJson(certificate.rawPayload) }}</pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Certificate {
  id: string;
  txHash: string;
  certificateType?: string;
  status: 'valid' | 'invalid' | 'unparsed';
  provider: string;
  observedAt: string;
  validatedAt?: string;
  scopeId?: string;
  nonce?: number;
  validationErrors?: string[];
  parsedPayload?: ParsedPayload;
  rawPayload?: unknown;
}

interface ParsedPayload {
  version?: number;
  scope?: {
    scopeType?: string;
    policyId?: string;
    poolId?: string;
    policyScripts?: string[];
  };
  featureSet?: number[];
  validation?: {
    method?: number;
    context?: string[];
  };
  nonce?: number;
  oracleUri?: string[];
  cipDetails?: Record<string, unknown>;
  calidusKey?: string;
  witnesses?: Array<{
    type?: number;
    publicKey?: string;
    signature?: string;
    raw?: unknown;
  }>;
  signatureValid?: boolean;
  signatureErrors?: string[];
  signatureVerifiedBy?: string[];
}

const props = defineProps<{
  selectedCertificate?: Certificate | null;
}>();

const tx = ref('');
const loading = ref(false);
const error = ref('');
const notFound = ref(false);
const certificate = ref<Certificate | null>(null);
const parsed = computed<ParsedPayload | undefined>(() => certificate.value?.parsedPayload);

const statusColor = (status: Certificate['status']) => {
  if (status === 'valid') return 'green';
  if (status === 'invalid') return 'red';
  return 'grey';
};

const network = import.meta.env.VITE_NETWORK || 'preprod';
const txUrl = (hash: string) =>
  network === 'mainnet'
    ? `https://cardanoscan.io/transaction/${hash}`
    : `https://${network}.cardanoscan.io/transaction/${hash}`;

const reset = () => {
  tx.value = '';
  error.value = '';
  notFound.value = false;
  certificate.value = null;
};

watch(
  () => props.selectedCertificate,
  (next) => {
    if (!next) return;
    error.value = '';
    notFound.value = false;
    certificate.value = next;
    tx.value = next.txHash;
  }
);

const lookup = async () => {
  error.value = '';
  notFound.value = false;
  certificate.value = null;
  if (!tx.value) {
    error.value = 'Enter a transaction hash';
    return;
  }
  loading.value = true;
  try {
    const res = await fetch(`/certificates?tx=${encodeURIComponent(tx.value)}`);
    const data = await res.json();
    const records: Certificate[] = data.data ?? [];
    if (!records.length) {
      notFound.value = true;
      return;
    }
    certificate.value = records[0];
  } catch (err: any) {
    error.value = err?.message ?? 'Lookup failed';
  } finally {
    loading.value = false;
  }
};

const validationMethodLabel = (method?: number) => {
  if (method === undefined || method === null) return 'unknown';
  if (method === 0) return 'ed25519';
  if (method === 1) return 'beacon/reference token';
  if (method === 2) return 'COSE / CIP-8';
  return String(method);
};

const formatJson = (data: unknown) => JSON.stringify(data, null, 2);
</script>
