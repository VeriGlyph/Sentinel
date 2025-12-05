import cors from 'cors';
import express from 'express';
import pino from 'pino';
import { loadConfig } from './config';
import { BlockfrostProvider } from './providers/blockfrost';
import { ProviderCheckpoint } from './providers/provider';
import { certificatesRouter } from './routes/certificates';
import { InMemoryCertificateStore } from './services/certificate-service';
import { PgCertificateStore } from './services/db';
import { ingestProviderEvents } from './services/certificate-ingestion';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { translateTime: 'SYS:standard' },
  },
});

async function main() {
  const app = express();
  const useDb = process.env.DATABASE_URL || process.env.DB_HOST;
  const store = useDb ? new PgCertificateStore() : new InMemoryCertificateStore();
  const config = loadConfig();

  let provider: BlockfrostProvider | undefined;
  let checkpoint: ProviderCheckpoint = { cursor: 1 };

  if (config.blockfrost) {
    provider = new BlockfrostProvider({
      projectId: config.blockfrost.projectId,
      network: config.blockfrost.network,
      metadataKey: 867,
      startHeight: config.blockfrost.startHeight,
      rateLimitPerSecond: config.blockfrost.rateLimitPerSecond,
      pageSize: config.blockfrost.pageSize,
    });
    logger.info(
      { provider: provider.name, startHeight: config.blockfrost.startHeight, rateLimit: config.blockfrost.rateLimitPerSecond },
      'blockfrost provider configured'
    );
  } else {
    logger.warn('Blockfrost provider not configured; set BLOCKFROST_PROJECT_ID and BLOCKFROST_NETWORK to enable');
  }

  app.use(cors());
  app.use(express.json());
  app.use('/certificates', certificatesRouter(store));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const port = config.port;
  app.listen(port, () => logger.info(`API listening on :${port}`));

  const basePollIntervalMs = process.env.POLL_INTERVAL_MS ? Number(process.env.POLL_INTERVAL_MS) : 5000;
  const tipPollIntervalMs = process.env.TIP_POLL_INTERVAL_MS ? Number(process.env.TIP_POLL_INTERVAL_MS) : 60000;
  let nextPollInterval = basePollIntervalMs;

  const loadCheckpoint = async () => {
    if (useDb && provider) {
      const dbCheckpoint = await (store as PgCertificateStore).getCheckpoint(provider.name);
      if (dbCheckpoint) {
        checkpoint = { cursor: dbCheckpoint.cursor, lastTxHash: dbCheckpoint.lastTxHash };
      }
    }
  };

  await loadCheckpoint();

  const poll = async () => {
    if (!provider) return;
    try {
      const events = await provider.pullSince(checkpoint);
      if (events.length) {
        await ingestProviderEvents(events, store, { nativeScriptResolver: provider });
        const pageSize = provider.getPageSize();
        const pageFull = events.length >= pageSize;
        if (pageFull) {
          checkpoint = { cursor: (checkpoint.cursor ?? 1) + 1, lastTxHash: events[events.length - 1].txHash };
        } else {
          checkpoint = { cursor: checkpoint.cursor ?? 1, lastTxHash: events[events.length - 1].txHash };
        }
        if (useDb) {
          await (store as PgCertificateStore).setCheckpoint(provider.name, checkpoint.cursor!, checkpoint.lastTxHash);
        }
        logger.info({ page: checkpoint.cursor, count: events.length, pageFull }, 'ingested provider events');
        // When we hit a partial page we are likely near the tip; slow down to avoid burning credits
        nextPollInterval = pageFull ? basePollIntervalMs : tipPollIntervalMs;
      } else {
        nextPollInterval = tipPollIntervalMs;
      }
    } catch (err) {
      logger.error({ err }, 'provider poll failed');
      if ((err as any)?.status === 404) {
        nextPollInterval = tipPollIntervalMs;
      }
    } finally {
      setTimeout(poll, nextPollInterval);
    }
  };

  poll();
}

main().catch((err) => {
  logger.error(err, 'server failed');
  process.exit(1);
});
