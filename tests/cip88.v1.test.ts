import {
    clone,
    getHash,
    jsToMap,
    normalizeForSignature,
    validateCip88,
    validateCoseSignature, verifySignature,
    Witness
} from "../src/lib/cip88";
import cbor from 'cbor';
import {hexToBytes} from "../src/lib/hex";

const raw_payload = {
    "867": {
        "0": 1,
        "1": {
            "1": [0, "0xd894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a0",
                [
                    "0x8200581c80a4556844b0f9228c8b40fb1bffe0eb743e68aec9f05dbe4be8e43d"
                ]
            ],
            "2": [26, 86],
            "3": [0],
            "4": 2,
            "6": {
                "26": {
                    "0": 1,
                    "1": [
                        {
                            "0": [
                                "0xd894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a0",
                                "0x7370616365636f696e73"
                            ],
                            "1": "spacecoins",
                            "2": [
                                "the OG Cardano community token - whatever you do, your did it!"
                            ],
                            "3": "SPACE",
                            "4": 0,
                            "5": [
                                "https://",
                                "spacecoins.io"
                            ],
                            "6": [
                                "https://",
                                "img.cexplorer.io/6/b/f/a/8/",
                                "asset1pmmzqf2akudknt05ealtvcvsy7n6wnc9dd03mf.png"
                            ]
                        }
                    ]
                },
                "86": {
                    "0": 1,
                    "1": {
                        "1": [
                            "addr_test1qp9r3mwucuhwqyj3vg7gdlyam2xurku0xj6f9qgamh5vefccd4u3lk",
                            "4wm9sjz2zs7mg2vlgtf8ru4v0p0truedrwm67s40jyta"
                        ],
                        "2": [
                            "addr_test1qp9r3mwucuhwqyj3vg7gdlyam2xurku0xj6f9qgamh5vefccd4u3lk",
                            "4wm9sjz2zs7mg2vlgtf8ru4v0p0truedrwm67s40jyta"
                        ]
                    }
                }
            }
        },
        "2": [
            [
                "0xd25ee869f7c34a5c6d68140469f2f8da83b1c0f0a81b6f5b09b5e1012d6c2030",
                "0xc03c557183cb696d763206530bcf79d18897fe7fc5b1f72f4e3c5fdd2dbf1902c728a2c72b2f5040c6a9c4c5cfa097b8c2246a775387fd1af2ca78f6d70aa809"
            ]
        ]
    }
};

describe('parse CIP-88 v1 and analyze', () => {
    const validated = validateCip88(raw_payload);
    // console.log(validated, validated.data?.witnesses);

    it('should validate', () => {
        expect(validated.ok).toBe(true);
    })

    const dataMap = jsToMap(clone(raw_payload['867']));
    const payloadMap = dataMap.get(1);

    const policy_id = payloadMap.get(1)[1];
    const policy_id_hex = policy_id.toString('hex');

    it('should find the correct policy ID', () => {
        expect(policy_id_hex).toBe('d894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a0');
    });

    const signature_payload = normalizeForSignature(raw_payload['867']['1'], false);

    it('should find the correct signature payload', () => {
        expect(signature_payload).toBe('a5018300581cd894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a08158208200581c80a4556844b0f9228c8b40fb1bffe0eb743e68aec9f05dbe4be8e43d0282181a1856038100040206a2181aa200010181a70082581cd894897411707efa755a76deb66d26dfd50593f2e70863e1661e98a04a7370616365636f696e73016a7370616365636f696e730281783e746865204f472043617264616e6f20636f6d6d756e69747920746f6b656e202d20776861746576657220796f7520646f2c20796f7572206469642069742103655350414345040005826868747470733a2f2f6d7370616365636f696e732e696f06836868747470733a2f2f781b696d672e636578706c6f7265722e696f2f362f622f662f612f382f7830617373657431706d6d7a716632616b75646b6e74303565616c747663767379376e36776e6339646430336d662e706e671856a2000101a201827840616464725f746573743171703972336d77756375687771796a3376673767646c79616d327875726b7530786a3666397167616d68357665666363643475336c6b782c34776d39736a7a327a73376d6732766c6774663872753476307030747275656472776d36377334306a79746102827840616464725f746573743171703972336d77756375687771796a3376673767646c79616d327875726b7530786a3666397167616d68357665666363643475336c6b782c34776d39736a7a327a73376d6732766c6774663872753476307030747275656472776d36377334306a797461');
    })

    // @ts-ignore
    for (const witness of validated.data?.witnesses) {
        if (witness.type === 0) {
            const pub = hexToBytes(witness.publicKey);
            const sig = hexToBytes(witness.signature as string);
            const ok = verifySignature(hexToBytes(signature_payload), sig, pub);
            expect(ok).toBe(true);
        }
    }
})