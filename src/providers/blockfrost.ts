import { ProviderCheckpoint, ProviderClient, ProviderEvent } from './provider';

type SupportedNetwork = 'mainnet' | 'preprod' | 'preview';

export interface BlockfrostConfig {
  projectId: string;
  network: SupportedNetwork;
  metadataKey: number;
  startHeight?: number;
  pageSize?: number;
  rateLimitPerSecond?: number;
}

interface BlockfrostMetadataItem {
  tx_hash: string;
  label: string;
  json_metadata?: unknown;
  cbor_metadata?: string;
}

interface BlockfrostTx {
  hash: string;
  block: string;
  block_height: number;
  slot: number;
}

const NETWORK_BASE: Record<SupportedNetwork, string> = {
  mainnet: 'https://cardano-mainnet.blockfrost.io/api/v0',
  preprod: 'https://cardano-preprod.blockfrost.io/api/v0',
  preview: 'https://cardano-preview.blockfrost.io/api/v0',
};

export class BlockfrostProvider implements ProviderClient {
  public readonly name = 'blockfrost';
  private readonly config: Required<Omit<BlockfrostConfig, 'startHeight'>> & { startHeight?: number };
  private readonly delayMs: number;
  private readonly baseUrl: string;

  constructor(config: BlockfrostConfig) {
    if (!config.projectId) {
      throw new Error('Blockfrost projectId required');
    }
    this.config = {
      metadataKey: config.metadataKey,
      network: config.network,
      projectId: config.projectId,
      pageSize: config.pageSize ?? 50,
      rateLimitPerSecond: config.rateLimitPerSecond ?? 10,
      startHeight: config.startHeight,
    };
    this.baseUrl = NETWORK_BASE[config.network];
    this.delayMs = Math.ceil(1000 / this.config.rateLimitPerSecond);
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { project_id: this.config.projectId },
    });
    if (!res.ok) {
      const body = await res.text();
      const err: any = new Error(`Blockfrost error ${res.status}: ${body}`);
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as T;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchTxDetails(txHash: string): Promise<BlockfrostTx> {
    const url = `${this.baseUrl}/txs/${txHash}`;
    const data = await this.fetchJson<BlockfrostTx>(url);
    await this.sleep(this.delayMs);
    return data;
  }

  private async fetchMetadataPage(page: number): Promise<BlockfrostMetadataItem[]> {
    const url = `${this.baseUrl}/metadata/txs/labels/${this.config.metadataKey}?order=asc&page=${page}&count=${this.config.pageSize}`;
    console.log(`Fetching metadata page ${page} from ${url}`);
    const data = await this.fetchJson<BlockfrostMetadataItem[]>(url);
    await this.sleep(this.delayMs);
    return data;
  }

  async fetchNativeScript(policyId: string): Promise<unknown | null> {
    const url = `${this.baseUrl}/scripts/${policyId}/json`;
    try {
      const data = await this.fetchJson<{ script: unknown }>(url);
      await this.sleep(this.delayMs);
      return data?.script ?? null;
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
  }

  async pullSince(checkpoint?: ProviderCheckpoint): Promise<ProviderEvent[]> {
    const page = checkpoint?.cursor ?? 1;
    const items = await this.fetchMetadataPage(page);
    if (!items.length) return [];

    const events: ProviderEvent[] = [];
    for (const item of items) {
      if (!item.json_metadata) continue;
      const tx = await this.fetchTxDetails(item.tx_hash);
      if (this.config.startHeight && tx.block_height < this.config.startHeight) {
        continue;
      }
      const metadataKey = Number(item.label ?? this.config.metadataKey) || this.config.metadataKey;
      events.push({
        txHash: tx.hash,
        blockHeight: tx.block_height,
        slot: tx.slot,
        provider: this.name,
        metadataKey,
        payload: item.json_metadata,
        observedAt: new Date().toISOString(),
      });
    }

    return events;
  }
}
