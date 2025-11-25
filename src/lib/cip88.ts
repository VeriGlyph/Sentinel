import {z} from 'zod';
import cbor from 'cbor';
import nacl from 'tweetnacl';
import {assertHexLength, hexToBytes, isHex, normalizeHex} from './hex';
import blakejs from 'blakejs';

export type Cip88Version = 1 | 2;

export type ScopeType = 'native_script' | 'stake_pool';

export interface ParsedScope {
    scopeType: ScopeType;
    policyId?: string;
    policyScripts?: string[];
    poolId?: string;
}

export interface ValidationMethod {
    method: number;
    context: string[];
}

export interface Witness {
    type?: number;
    publicKey: string;
    signature?: string;
    raw: unknown;
}

export interface ParsedCip88 {
    version: Cip88Version;
    scope: ParsedScope;
    featureSet: number[];
    validation: ValidationMethod;
    nonce: number;
    oracleUri?: string[];
    cipDetails?: Record<string, unknown>;
    calidusKey?: string;
    witnesses: Witness[];
    signatureValid?: boolean;
    signatureErrors?: string[];
    signatureVerifiedBy?: string[];
}

export interface ValidationResult {
    ok: boolean;
    errors: string[];
    data?: ParsedCip88;
    registrationRaw?: Record<string, unknown>;
}

// Borrowed from cardano-signer
const regExpHex = /^[0-9a-fA-F]+$/;		//matches a hex-string
const regExpHexWith0x = /^(0x)?[0-9a-fA-F]+$/;	//matches a hex-string with an optional 0x at the beginning
const regExpPath = /^[0-9]+H\/[0-9]+H\/[0-9]+H(\/[0-9]+H?){0,2}$/;  //path: first three elements must always be hardened, max. 5 elements
const regExpPathByron = /^[0-9]+H\/[0-9]+H(\/[0-9]+H){0,3}$/;  //path: first two elements must be hardened, than its open, max. 5 elements
const regExpPathYoroi = /^44H\/1815H\/[0-9]+H(\/[0-9]+H?){0,2}$/;  //path: first two elements must always be 44H/1815H, max. 5 elements
const regExpPathExodus = /^44H\/1815H\/[0-9]+H(\/[0-9]+H?){0,2}$/;  //path: first two elements must always be 44H/1815H, max. 5 elements
const regExpIntNumber = /^-?[0-9]+$/;

const hexString = (length?: number) =>
    z
        .string()
        .refine((val) => isHex(val), {message: 'expected hex string'})
        .refine((val) => assertHexLength(val, length), {
            message: length ? `expected ${length} bytes hex` : 'invalid hex length',
        })
        .transform((val) => (val.startsWith('0x') ? val : `0x${val}`));

const uriArray = z.array(z.string()).min(0);

const scopeArray = z.array(z.any()).min(2).max(3);

const knownValidationMethods: Record<string, number> = {
    ed25519: 0,
    beacon: 1,
    'reference token': 1,
    'cip-0008': 2,
    cose: 2,
};

const validationArray = z
    .array(z.any())
    .min(1)
    .transform((arr) => {
        const raw = arr[0];
        let method: number | undefined;
        if (typeof raw === 'string') {
            const mapped = knownValidationMethods[raw.toLowerCase()];
            if (mapped !== undefined) {
                method = mapped;
            } else {
                const parsed = Number(raw);
                method = Number.isNaN(parsed) ? undefined : parsed;
            }
        } else if (typeof raw === 'number') {
            method = raw;
        }
        return {method: method as any, context: arr.slice(1).map(String)};
    });

const witnessV1Schema = z
    .tuple([hexString(32), hexString(64)])
    .transform((arr) => ({
        type: 0,
        publicKey: arr[0],
        signature: arr[1],
        raw: arr,
    }));

const witnessV2Schema = z
    .object({
        0: z.number().optional(),
        1: hexString(32),
        2: hexString().optional(),
    })
    .transform((obj) => ({
        type: obj[0],
        publicKey: obj[1],
        signature: obj[2],
        raw: obj,
    }));

const witnessSchema = z.union([witnessV1Schema, witnessV2Schema, z.any().transform((raw) => ({raw}))]);

const scopeDetailsSchema = z.object({
    1: scopeArray,
    2: z.array(z.number()),
    3: validationArray,
    4: z.number(),
    5: uriArray.optional(),
    6: z.record(z.unknown()).optional(),
    7: hexString(32).optional(),
});

const registrationSchema = z.object({
    0: z.union([z.number(), z.string()]).optional(),
    1: scopeDetailsSchema,
    2: z.array(witnessSchema).optional(),
});

type ParsedScopeResult =
    | { ok: true; scope: ParsedScope }
    | { ok: false; errors: string[] };

function parseScope(scope: z.infer<typeof scopeArray>): ParsedScopeResult {
    let [scopeId, target, maybeScripts] = scope;
    if (Buffer.isBuffer(target)) {
        target = target.toString('hex');
    }
    if (Buffer.isBuffer(maybeScripts)) {
        maybeScripts = maybeScripts.toString('hex');
    }
    if (scopeId === 0) {
        if (typeof target !== 'string' || !assertHexLength(target, 28)) {
            return {ok: false, errors: ['invalid policyId in scope', target.length, assertHexLength(target, 28)]};
        }
        const scripts = Array.isArray(maybeScripts)
            ? maybeScripts.filter((s): s is string => typeof s === 'string' && isHex(s))
            : [];
        return {
            ok: true,
            scope: {scopeType: 'native_script', policyId: `0x${normalizeHex(target)}`, policyScripts: scripts}
        };
    }
    if (scopeId === 1) {
        if (typeof target !== 'string' || !assertHexLength(target, 28)) {
            return {ok: false, errors: ['invalid poolId in scope']};
        }
        return {ok: true, scope: {scopeType: 'stake_pool', poolId: `0x${normalizeHex(target)}`}};
    }
    return {ok: false, errors: [`unsupported scope id ${scopeId}`]};
}

/**
 * Convert a JS object (JSON.parse) to a Map in a CBOR-friendly way
 *
 * @param obj
 */
export function jsToMap(obj: any) {
    switch (typeof obj) {
        case "object":
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    obj[i] = jsToMap(obj[i]);
                }
                return obj;
            } else if (Buffer.isBuffer(obj)) {
                return obj;
            } else {
                const myMap = new Map();
                for (const [key, value] of Object.entries(obj)) {
                    if (regExpIntNumber.test(key)) {
                        myMap.set(parseInt(key), jsToMap(value))
                    } else {
                        myMap.set(key, jsToMap(value));
                    }
                }
                return myMap;
            }
        default:
            if (obj.match !== undefined) {
                return obj.match(regExpHexWith0x) ? Buffer.from(obj.replace('0x', ''), 'hex') : obj;
            }
            return obj;
    }
}

export function clone(obj: any) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Get a blake2b hash of the given content
 * @param content
 * @param digestLengthBytes
 */
export function getHash(content: any, digestLengthBytes: number = 32) {
    return blakejs.blake2bHex(Buffer.from(content, 'hex'), undefined, digestLengthBytes)
}

export function normalizeForSignature(payload: object, hash: boolean = true) {
    const payloadMap = jsToMap(clone(payload));
    const payloadCborHex = cbor.encode(payloadMap).toString('hex');
    return hash ? getHash(payloadCborHex) : payloadCborHex;
}

/**
 * simple helper function to verify a signature matches a provided message and public key
 *
 * @param msg
 * @param sig
 * @param pubKey
 */
export function verifySignature(msg: Buffer | Uint8Array, sig: Buffer | Uint8Array, pubKey: Buffer | Uint8Array) {
    return nacl.sign.detached.verify(
        msg,
        sig,
        pubKey
    );
}

export function validateCoseSignature(payload: string, signature: Map<number, any>) {

    const coseKeyMap = signature.get(1) as Map<number, any>;
    const coseSign1Map = signature.get(2) as any[];

    if (payload !== coseSign1Map[2].toString('hex')) {
        return {
            status: false,
            error: "payload does not match signature payload"
        }
    }

    if (coseKeyMap.get(-2).length !== 32) {
        return {
            status: false,
            error: "invalid public key in signature"
        }
    }

    const sigPubKey = coseKeyMap.get(-2);
    const pubKeyHex = sigPubKey.toString('hex');

    const coseProtectedHeaderMap = cbor.decode(coseSign1Map[0]);

    if (getHash(pubKeyHex, 28) !== coseProtectedHeaderMap.get("address").toString("hex")) {
        return {
            status: false,
            error: "public key does not match address in signature"
        }
    }

    const coseIsHashed = coseSign1Map[1];

    const verifyDataHex = coseIsHashed ? getHash(payload) : payload;
    const signature_hex = coseSign1Map[3].toString('hex');
    const sig_structure = [
        "Signature1",
        coseSign1Map[0],
        Buffer.from(''),
        Buffer.from(verifyDataHex, 'hex')
    ];
    const sig_structure_cbor_hex = cbor.encode(sig_structure).toString('hex');

    return {
        status: verifySignature(
            Buffer.from(sig_structure_cbor_hex, 'hex'),
            Buffer.from(signature_hex, 'hex'),
            Buffer.from(pubKeyHex, 'hex')
        ),
        pubKey: pubKeyHex,
        pubKeyHash: getHash(pubKeyHex, 28),
    }
}

export function validateCip88(metadata: unknown): ValidationResult {
    const errors: string[] = [];
    if (metadata === null || typeof metadata !== 'object') {
        return {ok: false, errors: ['metadata must be an object']};
    }

    const metadataObj = metadata as Record<string, unknown>;
    const entry = (metadataObj['867'] ?? metadataObj[867]) as unknown;
    if (!entry || typeof entry !== 'object') {
        return {ok: false, errors: ['metadata[867] missing']};
    }

    const parsed = registrationSchema.safeParse(entry);
    if (!parsed.success) {
        return {
            ok: false,
            errors: parsed.error.errors.map((e) => `schema: ${e.path.join('.') || 'root'} ${e.message}`)
        };
    }

    const registration = parsed.data;
    const versionRaw = registration['0'] ?? 1;
    const version =
        typeof versionRaw === 'string' ? Number.parseInt(versionRaw.split('.')[0], 10) : (versionRaw as number);
    if (Number.isNaN(version) || (version !== 1 && version !== 2)) {
        return {ok: false, errors: [`unsupported version ${versionRaw}`]};
    }

    const scopeResult = parseScope(registration['1']['1']);
    if (!scopeResult.ok) {
        errors.push(...scopeResult.errors);
        return {ok: false, errors};
    }

    if (version === 1 && scopeResult.scope.scopeType !== 'native_script') {
        return {ok: false, errors: ['version 1 only supports native_script scope']};
    }

    const featureSet = registration['1']['2'];
    const validation = registration['1']['3'];
    const nonce = registration['1']['4'];
    const oracleRaw = registration['1']['5'];
    const oracleUri = Array.isArray(oracleRaw) && oracleRaw.length === 0 ? undefined : oracleRaw;
    const cipDetails = registration['1']['6'] as Record<string, unknown> | undefined;
    const calidusKey = registration['1']['7'] ? `0x${normalizeHex(registration['1']['7']!)}` : undefined;

    const witnesses =
        registration['2']?.map((w) => w as Witness) ?? [];

    return {
        ok: errors.length === 0,
        errors,
        data: {
            version: version as Cip88Version,
            scope: scopeResult.scope,
            featureSet,
            validation,
            nonce,
            oracleUri,
            cipDetails,
            calidusKey,
            witnesses,
        },
        registrationRaw: entry as Record<string, unknown>,
    };
}

export interface SignatureVerificationResult {
    status: 'valid' | 'invalid' | 'unsupported';
    errors: string[];
    verifiedBy?: string[];
}

export function verifyCip88Signatures(
    registrationRaw: Record<string, unknown>,
    parsed: ParsedCip88
): SignatureVerificationResult {
    const method = parsed.validation.method;
    if (method === 1 || method === undefined) {
        return {status: 'unsupported', errors: [`validation method ${method} not yet supported`]};
    }

    const cert_type = (parsed.version === 2 && parsed.scope.scopeType === 'stake_pool') ? 'cip-151' : 'cip-88';
    const hash_payload = cert_type === 'cip-151';

    const payloadCborHash = normalizeForSignature(registrationRaw[1] as Record<string, unknown>, hash_payload);

    const errors: string[] = [];
    const verifiedBy: string[] = [];
    for (const witness of parsed.witnesses) {
        if (method === 0) {
            if (!witness.publicKey || !witness.signature) {
                errors.push('witness missing public key or signature');
                continue;
            }
            const pub = hexToBytes(witness.publicKey);
            const sig = hexToBytes(witness.signature);
            if (sig.length !== 64 || pub.length !== 32) {
                errors.push('witness has invalid key/signature length');
                continue;
            }
            const ok = nacl.sign.detached.verify(hexToBytes(payloadCborHash), sig, pub);
            if (ok) {
                verifiedBy.push(witness.publicKey);
            } else {
                // console.log('Could not validate', witness, payloadCborHash);
                errors.push(`signature verification failed for ${witness.publicKey}`);
            }
        } else if (method === 2) {
            const verified = validateCoseSignature(
                payloadCborHash,
                jsToMap(clone(witness.raw))
            );
            const ok = verified.status;
            if (ok) {
                verifiedBy.push(`0x${normalizeHex(verified.pubKey)}`);
            } else {
                errors.push(`cose signature verification failed`);
            }
        }
    }

    if (verifiedBy.length > 0) {
        return {status: 'valid', errors, verifiedBy};
    }

    if (method === 2) {
        return {status: 'unsupported', errors: errors.length ? errors : ['no valid COSE signatures found']};
    }

    return {status: 'invalid', errors: errors.length ? errors : ['no valid signatures found']};
}
