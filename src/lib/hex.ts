export function normalizeHex(input: string): string {
    return input.startsWith('0x') ? input.slice(2) : input;
}

export function isHex(input: string): boolean {
    const value = normalizeHex(input);
    return value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value);
}

export function assertHexLength(input: string, byteLength?: number): boolean {
    if (!isHex(input)) return false;
    if (byteLength === undefined) return true;
    const value = normalizeHex(input);
    return value.length === byteLength * 2;
}

export function hexToBytes(input: string): Uint8Array {
    const value = normalizeHex(input);
    return new Uint8Array(Buffer.from(value, 'hex'));
}
