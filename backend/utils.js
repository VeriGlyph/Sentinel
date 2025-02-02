const cbor = require('cbor');
const jsToCbor = (obj) => {
    const hex_regex = /^[0-9A-Fa-f]+$/g;

    switch (typeof obj) {
        case "object":
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    obj[i] = jsToCbor(obj[i]);
                }
                return obj;
            } else if (Buffer.isBuffer(obj)) {
                return obj;
            } else {
                const cborMap = new cbor.Map();
                for (const [key, value] of Object.entries(obj)) {
                    const intKey = parseInt(key);
                    cborMap.set(intKey, jsToCbor(value));
                }
                return cborMap;
            }
        default:
            if (obj.match !== undefined) {
                return obj.match(hex_regex) ? Buffer.from(obj, 'hex') : obj;
            }
            return obj;
    }
}

module.exports = {
    jsToCbor
}