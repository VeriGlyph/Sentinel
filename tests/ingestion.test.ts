import { readFileSync } from 'fs';
import path from 'path';
import cbor from 'cbor';
import nacl from 'tweetnacl';
import { InMemoryCertificateStore } from '../src/services/certificate-service';
import { ingestProviderEvents } from '../src/services/certificate-ingestion';
import { ProviderEvent } from '../src/providers/provider';
import { getHash, normalizeForSignature } from '../src/lib/cip88';
import { hexToBytes } from '../src/lib/hex';

function loadJson(relPath: string) {
    const abs = path.join(__dirname, '..', relPath);
    return JSON.parse(readFileSync(abs, 'utf8'));
}

describe('ingestProviderEvents', () => {
    it('stores valid CIP-151 certificates as valid', async () => {
        const store = new InMemoryCertificateStore();
        const fixture = loadJson('./.resources/CIP-0151/CIP88_Master_v2.example.json');
        const event: ProviderEvent = {
            txHash: 'abc',
            blockHeight: 100,
            slot: 200,
            provider: 'test',
            metadataKey: 867,
            payload: fixture[867],
            observedAt: new Date().toISOString(),
        };

        const results = await ingestProviderEvents([event], store);
        expect(results[0].ok).toBe(true);
        const records = await store.getCertificates();
        expect(records[0].status).toBe('valid');
        expect(records[0].certificateType).toBe('cip-151');
    });

    it('marks invalid when metadata is missing', async () => {
        const store = new InMemoryCertificateStore();
        const event: ProviderEvent = {
            txHash: 'def',
            blockHeight: 101,
            slot: 201,
            provider: 'test',
            metadataKey: 123,
            payload: {something: 'else'},
            observedAt: new Date().toISOString(),
        };
        const results = await ingestProviderEvents([event], store);
        expect(results[0].ok).toBe(false);
        const records = await store.getCertificates();
        expect(records[0].status).toBe('invalid');
    });

    it('marks unsupported scope as unparsed', async () => {
        const store = new InMemoryCertificateStore();
        const event: ProviderEvent = {
            txHash: 'ghi',
            blockHeight: 102,
            slot: 202,
            provider: 'test',
            metadataKey: 867,
            payload: {
                0: 1,
                1: {
                    1: [2, '0x' + 'aa'.repeat(28)],
                    2: [],
                    3: [0],
                    4: 1,
                },
            },
            observedAt: new Date().toISOString(),
        };
        const results = await ingestProviderEvents([event], store);
        expect(results[0].ok).toBe(false);
        const records = await store.getCertificates();
        expect(records[0].status).toBe('unparsed');
    });

    it('rejects replayed nonce with lower value', async () => {
        const store = new InMemoryCertificateStore();
        const baseEvent: ProviderEvent = {
            txHash: 'tx1',
            blockHeight: 200,
            slot: 300,
            provider: 'test',
            metadataKey: 867,
            payload: {
                "0": 1,
                "1": {
                    "1": [0, "0xdc353db8d5c7ecf7807db5ff4a122ec1d13051f325687819fdf8bbed", ["0x82018282051a04e9bdc58200581cd51ed18c0407b2f47bb0962b670f78c6efb955deca621403b3d32c3f"]],
                    "2": [25],
                    "3": [0],
                    "4": 1,
                    "6": {"25": {"0": 1, "1": {"0": "Adam's Collection", "1": ["This is the collection description"]}}}
                },
                "2": [["0x88f25cdb60460a069df74a85cbdc66e2d0d8abc09f4af1c672bc7bbd2e6e4a0d", "0xb470ae57840250a881186c5d5b47a276b6786ce1eb7497860e74bfdae7b8e98d6c052741187334b230d208aaafbf3ac17e1c57a8b36aec4850ffe705d67bba0d"]]
            },
            observedAt: new Date().toISOString(),
        };
        await ingestProviderEvents([baseEvent], store);

        const replayEvent: ProviderEvent = {
            ...baseEvent,
            txHash: 'tx2',
            payload: {"0": 1,
                "1": {
                    "1": [0, "0xdc353db8d5c7ecf7807db5ff4a122ec1d13051f325687819fdf8bbed", ["0x82018282051a04e9bdc58200581cd51ed18c0407b2f47bb0962b670f78c6efb955deca621403b3d32c3f"]],
                    "2": [25],
                    "3": [0],
                    "4": 1,
                    "6": {"25": {"0": 1, "1": {"0": "Adam's Collection", "1": ["This is the collection description"]}}}
                },
                "2": [["0x88f25cdb60460a069df74a85cbdc66e2d0d8abc09f4af1c672bc7bbd2e6e4a0d", "0xb470ae57840250a881186c5d5b47a276b6786ce1eb7497860e74bfdae7b8e98d6c052741187334b230d208aaafbf3ac17e1c57a8b36aec4850ffe705d67bba0d"]]
            },
        };
        const results = await ingestProviderEvents([replayEvent], store);

        expect(results[0].ok).toBe(false);
        const records = await store.getCertificates({txHash: 'tx2'});
        expect(records[0].status).toBe('invalid');
    });

    const buildSignedNativeScriptEvent = (opts?: { policyScripts?: string[]; policyId?: string; witnessKey?: Uint8Array }) => {
        const keyPair = nacl.sign.keyPair();
        const pubKey = opts?.witnessKey ?? keyPair.publicKey;
        const pubKeyHex = Buffer.from(pubKey).toString('hex');
        const pubKeyHash = getHash(pubKeyHex, 28);
        const scriptCbor = cbor.encode([0, Buffer.from(pubKeyHash, 'hex')]).toString('hex');
        const policyId = opts?.policyId ?? getHash(scriptCbor, 28);
        const payload = {
            1: {
                1: [0, `0x${policyId}`, opts?.policyScripts ?? [`0x${scriptCbor}`]],
                2: [],
                3: [0],
                4: 1,
            },
            2: [[`0x${pubKeyHex}`, '']], // signature placeholder for now
        };
        const messageHex = normalizeForSignature(payload[1], false);
        const signature = nacl.sign.detached(hexToBytes(messageHex), keyPair.secretKey);
        payload[2][0][1] = `0x${Buffer.from(signature).toString('hex')}`;

        const event: ProviderEvent = {
            txHash: 'native-script',
            blockHeight: 123,
            slot: 456,
            provider: 'test',
            metadataKey: 867,
            payload,
            observedAt: new Date().toISOString(),
        };
        return { event, pubKeyHash };
    };

    it('marks native_script certificate invalid when signing key not in policy', async () => {
        const store = new InMemoryCertificateStore();
        const { event } = buildSignedNativeScriptEvent({
            policyScripts: [`0x${cbor.encode([0, Buffer.from('ff'.repeat(28), 'hex')]).toString('hex')}`],
        });
        const results = await ingestProviderEvents([event], store);
        expect(results[0].ok).toBe(false);
        const record = (await store.getCertificates())[0];
        expect(record.status).toBe('invalid');
        expect(record.validationErrors?.join(' ')).toMatch(/signing key not found/i);
    });

    it('uses resolver to fetch native script when missing and validates key hash', async () => {
        const store = new InMemoryCertificateStore();
        const { event, pubKeyHash } = buildSignedNativeScriptEvent({ policyScripts: [] });
        const resolver = {
            fetchNativeScript: jest.fn(async () => cbor.decode(Buffer.from(cbor.encode([0, Buffer.from(pubKeyHash, 'hex')])))),
        };

        const results = await ingestProviderEvents([event], store, { nativeScriptResolver: resolver });
        expect(results[0].ok).toBe(true);
        const record = (await store.getCertificates())[0];
        expect(record.status).toBe('valid');
        expect(resolver.fetchNativeScript).toHaveBeenCalled();
        expect(record.scopeId?.startsWith('0x')).toBe(false);
    });

    it('marks native_script certificate unparsed when policy cannot be fetched', async () => {
        const store = new InMemoryCertificateStore();
        const { event } = buildSignedNativeScriptEvent({ policyScripts: [] });
        const resolver = { fetchNativeScript: jest.fn(async () => null) };
        const results = await ingestProviderEvents([event], store, { nativeScriptResolver: resolver });
        expect(results[0].ok).toBe(false);
        const record = (await store.getCertificates())[0];
        expect(record.status).toBe('unparsed');
        expect(record.validationErrors?.join(' ')).toMatch(/unavailable/i);
    });
});
