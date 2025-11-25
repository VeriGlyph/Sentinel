<template>
  <v-app>
    <v-app-bar flat class="veriglyph-gradient-bg text-white">
      <v-container class="py-0">
        <v-row align="center" no-gutters>
          <v-col class="" cols="12" md="7">
            <v-img :src="logo" max-height="46" width="220" contain
                   class="mr-4"/>
          </v-col>
          <v-col
              class="d-none d-md-flex justify-end text-caption text-medium-emphasis">
            VeriGlyph: Sentinel v2.0.0<br />
            Network: {{ networkLabel }}
          </v-col>
        </v-row>
      </v-container>
    </v-app-bar>

    <v-main class="veriglyph-background">
      <v-container class="py-10">
        <v-row dense>
          <v-col cols="12" md="7">
            <CertificateList class="veriglyph-card mb-4"
                             @view-certificate="handleViewCertificate"/>
          </v-col>
          <v-col cols="12" md="5">
            <TxLookup class="veriglyph-card"
                      :selected-certificate="selectedCertificate"/>
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <v-footer class="veriglyph-gradient-bg text-white" app padless>
      <v-container>
        <v-row align="center" no-gutters>
          <v-col cols="12" md="8">
            <div class="text-body-2 font-weight-medium">
              Made with
              <v-icon color="red">mdi-heart</v-icon>
              by Adam K. Dean
            </div>
            <div class="text-body-2 font-weight-medium">
              Released without warranty as open source under
              <a
                  href="https://github.com/VeriGlyph/Sentinel/blob/main/LICENSE"
                  target="_blank"
              >Apache-2.0 License</a
              >
            </div>
            <div class="text-body-2 font-weight-medium">
              <v-btn
                  href="https://github.com/VeriGlyph/Sentinel"
                  target="_blank"
                  color=""
              >
                <span class="mr-2">View on Github</span>
                <v-icon>mdi-github</v-icon>
              </v-btn>
            </div>
          </v-col>
          <v-spacer />
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import CertificateList from './components/CertificateList.vue';
import TxLookup from './components/TxLookup.vue';
import logo from './assets/veriglyph-header-purple.png';

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
  parsedPayload?: unknown;
  rawPayload?: unknown;
}

const selectedCertificate = ref<Certificate | null>(null);
const handleViewCertificate = (certificate: Certificate) => {
  selectedCertificate.value = certificate;
};

const networkLabel = import.meta.env.VITE_NETWORK || 'preprod';
</script>
