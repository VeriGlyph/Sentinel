import { Router } from 'express';
import { z } from 'zod';
import { InMemoryCertificateStore } from '../services/certificate-service';
import { PgCertificateStore } from '../services/db';
import { TTLCache } from '../services/cache';

export function certificatesRouter(store: InMemoryCertificateStore | PgCertificateStore): Router {
  const router = Router();
  const querySchema = z.object({
    status: z.enum(['valid', 'invalid', 'unparsed']).optional(),
    type: z.string().optional(),
    tx: z.string().optional(),
    provider: z.string().optional(),
  });

  router.get('/', async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const records = await store.getCertificates({
      status: parsed.data.status as any,
      type: parsed.data.type,
      txHash: parsed.data.tx,
      provider: parsed.data.provider,
    });
    return res.json({ data: records });
  });

  const latestSchema = z.object({
    scope: z.enum(['policy', 'pool']),
    id: z.string(),
    slot: z.string().optional(),
  });
  const cache = new TTLCache<any>(60000);

  router.get('/latest', async (req, res) => {
    const parsed = latestSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const scopeId = parsed.data.id;
    const slot = parsed.data.slot ? Number(parsed.data.slot) : undefined;
    const cacheKey = `${parsed.data.scope}:${scopeId}:${slot ?? 'latest'}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ data: cached, cached: true });

    if (!('getLatestCertificate' in store)) {
      return res.status(500).json({ error: 'latest lookup not supported in memory store' });
    }
    const record = await (store as any).getLatestCertificate(scopeId, slot);
    if (!record) return res.status(404).json({ error: 'not found' });
    cache.set(cacheKey, record);
    return res.json({ data: record });
  });

  return router;
}
