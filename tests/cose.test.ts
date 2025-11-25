import {getHash, jsToMap, validateCoseSignature} from "../src/lib/cip88";
import cbor from 'cbor';

const sample_raw = {
    "0": 2,
    "1": {
        "1": [1, "0x734d79d93fb78fc7dcf626efd477df5286bb28cdf807fec975073a83"
        ],
        "2": [],
        "3": [2],
        "4": 170628783,
        "7": "0x713aef7c3c2cdd7aeb89873fdcecd61b1743597759c272cea325de56cd6eb90c"
    },
    "2": [
        {
            "1": {
                "1": 1,
                "3": -8,
                "-1": 6,
                "-2": "0xba77e5c7ee32a4bcd99428bd7403f657cf9097a44275c0982a9785ac44edae1b"
            },
            "2": [
                "0xa201276761646472657373581c734d79d93fb78fc7dcf626efd477df5286bb28cdf807fec975073a83",
                0,
                "0xfe1c77e2dcbc79ddeb424bf72203f884c4e96e317e382a8d0c03b4a971cad522",
                "0x5d7302be8b931a16f6684831c355064b771f7ba8f28a8d6282d149b7f1723476340b34a526853fde3d373bdde16851675cedfd695af21265a39bea4faebc2803"
            ]
        }
    ]
}

describe('parse CIP-88 COSE payload', () => {
    const dataMap = jsToMap(sample_raw);
    const payloadMap = dataMap.get(1);
    const signatureMap = dataMap.get(2);

    const poolId = payloadMap.get(1)[1];
    const poolIdHex = poolId.toString('hex');

    it('should find the correct pool ID', () => {
        expect(poolIdHex).toBe('734d79d93fb78fc7dcf626efd477df5286bb28cdf807fec975073a83');
    });

    const calidusPubKey = payloadMap.get(7);
    const calidusPubKeyHex = calidusPubKey.toString('hex');

    it('should identify the Calidus key', () => {
        expect(calidusPubKeyHex).toBe('713aef7c3c2cdd7aeb89873fdcecd61b1743597759c272cea325de56cd6eb90c');
    })

    const payloadCborHex = cbor.encode(payloadMap).toString('hex');
    const payloadCborHash = getHash(payloadCborHex);
    const coseKeyMap = signatureMap[0].get(1);
    const coseSign1Map = signatureMap[0].get(2);

    it('should calculate the correct hash', () => {
        expect(payloadCborHash).toBe(coseSign1Map[2].toString('hex'));
    })

    it('should have a public key', () => {
        expect(coseKeyMap.get(-2).length).toBe(32);
    })

    const sigPubKey = coseKeyMap.get(-2);
    const pubKeyHex = sigPubKey.toString('hex');
    const pubKeyPoolIdHex = getHash(pubKeyHex, 28);

    it('signature keyhash should match pool ID', () => {
        expect(pubKeyPoolIdHex).toBe(poolIdHex);
    })

    const coseProtectedHeaderMap = cbor.decode(coseSign1Map[0]);
    const cosePoolIdHex = coseProtectedHeaderMap.get("address").toString("hex");

    it('cose address should match pool ID', () => {
        expect(cosePoolIdHex).toBe(poolIdHex);
    })

    const verified = validateCoseSignature(payloadCborHash, signatureMap[0]);

    it('should verify the signature', () => {
        expect(verified.status).toBe(true);
        expect(verified.pubKeyHash).toBe(poolIdHex);
    })
})
