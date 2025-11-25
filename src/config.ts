import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  blockfrost?: {
    projectId: string;
    network: 'mainnet' | 'preprod' | 'preview';
    startHeight?: number;
    rateLimitPerSecond?: number;
    pageSize?: number;
  };
}

export function loadConfig(): AppConfig {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const projectId = process.env.BLOCKFROST_PROJECT_ID;
  const network = process.env.BLOCKFROST_NETWORK as 'mainnet' | 'preprod' | 'preview' | undefined;

  const blockfrost =
    projectId && network
      ? {
          projectId,
          network,
          startHeight: process.env.BLOCKFROST_START_HEIGHT
            ? Number(process.env.BLOCKFROST_START_HEIGHT)
            : undefined,
          rateLimitPerSecond: process.env.BLOCKFROST_RATE_LIMIT
            ? Number(process.env.BLOCKFROST_RATE_LIMIT)
            : undefined,
          pageSize: process.env.BLOCKFROST_PAGE_SIZE ? Number(process.env.BLOCKFROST_PAGE_SIZE) : undefined,
        }
      : undefined;

  return { port, blockfrost };
}
