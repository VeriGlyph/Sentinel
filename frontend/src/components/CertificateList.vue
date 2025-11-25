<template>
  <v-card elevation="2">
    <v-card-title class="d-flex justify-space-between align-center">
      <div>
        <div class="text-subtitle-1 font-weight-bold">CIP-88/151 Certificates</div>
        <div class="text-caption text-medium-emphasis">Browse observed certificates and validation status.</div>
      </div>
      <v-btn color="primary" size="small" @click="load">Refresh</v-btn>
    </v-card-title>
    <v-card-text>
      <v-row class="mb-4" dense>
        <v-col cols="12" md="4">
          <v-select
            v-model="filters.status"
            :items="statusOptions"
            label="Status"
            clearable
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="filters.tx" label="TX Hash" density="compact" clearable />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="filters.type" label="Certificate Type" density="compact" clearable />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model="filters.scopeId" label="Policy/Pool ID" density="compact" clearable />
        </v-col>
      </v-row>
    </v-card-text>
    <v-data-table
      :headers="headers"
      :items="certificates"
      class="mt-2"
      :loading="loading"
      item-value="id"
    >
      <template #item.status="{ item }">
        <v-chip :color="statusColor(item.status)" size="small" variant="flat">
          {{ item.status }}
        </v-chip>
      </template>
      <template #item.txHash="{ item }">
        <a :href="txUrl(item.txHash)" target="_blank" rel="noreferrer">{{ item.txHash }}</a>
      </template>
      <template #item.actions="{ item }">
        <v-btn
          variant="text"
          color="primary"
          size="small"
          @click="viewCertificate(item)"
        >
          View
        </v-btn>
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

interface Certificate {
  id: string;
  txHash: string;
  certificateType?: string;
  status: 'valid' | 'invalid' | 'unparsed';
  provider: string;
  observedAt: string;
  scopeId?: string;
  nonce?: number;
  validatedAt?: string;
  validationErrors?: string[];
  parsedPayload?: unknown;
  rawPayload?: unknown;
}

const emit = defineEmits<{
  (e: 'view-certificate', certificate: Certificate): void;
}>();

const certificates = ref<Certificate[]>([]);
const loading = ref(false);

const filters = reactive({
  status: null as Certificate['status'] | null,
  tx: '',
  type: '',
  scopeId: '',
});

const headers = [
  { title: 'TX Hash', key: 'txHash' },
  // { title: 'Scope ID', key: 'scopeId' },
  // { title: 'Nonce', key: 'nonce' },
  { title: 'Type', key: 'certificateType' },
  { title: 'Status', key: 'status' },
  // { title: 'Provider', key: 'provider' },
  { title: 'Observed', key: 'observedAt' },
  { title: 'Details', key: 'actions', sortable: false },
];

const statusOptions = ['valid', 'invalid', 'unparsed'];

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

const load = async () => {
  loading.value = true;
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.tx) params.set('tx', filters.tx);
  if (filters.type) params.set('type', filters.type);
  if (filters.scopeId) params.set('scopeId', filters.scopeId);
  try {
    const res = await fetch(`/certificates?${params.toString()}`);
    const data = await res.json();
    certificates.value = data.data ?? [];
  } finally {
    loading.value = false;
  }
};

const viewCertificate = (certificate: Certificate) => {
  emit('view-certificate', certificate);
};

onMounted(load);
</script>
