import {readFileSync} from 'fs';
import path from 'path';
import nacl from 'tweetnacl';
import {normalizeForSignature, validateCip88, verifyCip88Signatures} from '../src/lib/cip88';
import {hexToBytes} from "../src/lib/hex";

function loadJson(relPath: string) {
    const abs = path.join(__dirname, '..', relPath);
    return JSON.parse(readFileSync(abs, 'utf8'));
}

describe('validateCip88', () => {
    it('parses the CIP-151 example (v2)', () => {
        const fixture = loadJson('./.resources/CIP-0151/CIP88_Master_v2.example.json');
        const result = validateCip88(fixture);
        expect(result.ok).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.version).toBe(2);
        expect(result.data?.scope.scopeType).toBe('stake_pool');
        expect(result.data?.calidusKey).toBeDefined();
    });

    it('parses a minimal v1 native script certificate', () => {
        const metadata = {
            867: {
                1: {
                    1: [0, `0x${'aa'.repeat(28)}`, [`0x${'bb'.repeat(32)}`]],
                    2: [],
                    3: [0],
                    4: 123,
                },
                2: [[`0x${'cc'.repeat(32)}`, `0x${'dd'.repeat(64)}`]],
            },
        };
        const result = validateCip88(metadata);
        expect(result.ok).toBe(true);
        expect(result.data?.version).toBe(1);
        expect(result.data?.scope.scopeType).toBe('native_script');
    });

    it('fails on unsupported version', () => {
        const metadata = {
            867: {
                0: 99,
                1: {
                    1: [0, `0x${'aa'.repeat(28)}`],
                    2: [],
                    3: [0],
                    4: 1,
                },
            },
        };
        const result = validateCip88(metadata);
        expect(result.ok).toBe(false);
        expect(result.errors.join(' ')).toMatch(/unsupported version/i);
    });

    it('accepts string version and validation method name', () => {
        const metadata = {
            867: {
                0: '1.0.0',
                1: {
                    1: [0, `0x${'aa'.repeat(28)}`],
                    2: [26],
                    3: ['Ed25519'],
                    4: 123,
                },
                2: [[`0x${'cc'.repeat(32)}`, `0x${'dd'.repeat(64)}`]],
            },
        };
        const result = validateCip88(metadata);
        expect(result.ok).toBe(true);
        expect(result.data?.version).toBe(1);
        expect(result.data?.validation.method).toBe(0);
    });

    it('allows empty oracle URI array', () => {
        const metadata = {
            867: {
                1: {
                    1: [0, `0x${'aa'.repeat(28)}`],
                    2: [],
                    3: [0],
                    4: 1,
                    5: [],
                },
            },
        };
        const result = validateCip88(metadata);
        expect(result.ok).toBe(true);
        expect(result.data?.oracleUri).toBeUndefined();
    });

    it('verifies an ed25519 witness', () => {
        const keyPair = nacl.sign.keyPair();
        const payload = {
            1: [0, `0x${'aa'.repeat(28)}`, `0x${'bb'.repeat(32)}`],
            2: [],
            3: [0],
            4: 1,
        };
        // Sign canonical CBOR of payload
        const message = normalizeForSignature(payload, false);
        const signature = nacl.sign.detached(hexToBytes(message), keyPair.secretKey);

        const metadata = {
            867: {
                1: payload,
                2: [[`0x${Buffer.from(keyPair.publicKey).toString('hex')}`, `0x${Buffer.from(signature).toString('hex')}`]],
            },
        };

        const result = validateCip88(metadata);
        expect(result.ok).toBe(true);
        const sigResult = verifyCip88Signatures(result.registrationRaw!, result.data!);
        if (sigResult.status !== 'valid') {
            console.log(sigResult);
        }
        expect(sigResult.status).toBe('valid');
        expect(sigResult.verifiedBy?.length).toBeGreaterThan(0);
    });

    it('verifies CIP-151 style COSE witness with payload hash', () => {
        const metadata = {
            867: {
                0: 2,
                1: {
                    1: [1, '0x734d79d93fb78fc7dcf626efd477df5286bb28cdf807fec975073a83'],
                    2: [],
                    3: [2],
                    4: 170628783,
                    7: '0x713aef7c3c2cdd7aeb89873fdcecd61b1743597759c272cea325de56cd6eb90c',
                },
                2: [
                    {
                        1: {
                            1: 1,
                            3: -8,
                            '-1': 6,
                            '-2': '0xba77e5c7ee32a4bcd99428bd7403f657cf9097a44275c0982a9785ac44edae1b'
                        },
                        2: [
                            '0xa201276761646472657373581c734d79d93fb78fc7dcf626efd477df5286bb28cdf807fec975073a83',
                            0,
                            '0xfe1c77e2dcbc79ddeb424bf72203f884c4e96e317e382a8d0c03b4a971cad522',
                            '0x5d7302be8b931a16f6684831c355064b771f7ba8f28a8d6282d149b7f1723476340b34a526853fde3d373bdde16851675cedfd695af21265a39bea4faebc2803',
                        ],
                    },
                ],
            },
        };

        const result = validateCip88(metadata);
        expect(result.ok).toBe(true);
        const sigResult = verifyCip88Signatures(result.registrationRaw!, result.data!);
        expect(sigResult.status).toBe('valid');
    });
});
