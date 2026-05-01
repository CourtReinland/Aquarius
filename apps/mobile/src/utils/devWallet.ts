let devPrivateKey: `0x${string}` | undefined;

export function getDevKey(): `0x${string}` | undefined {
  return devPrivateKey || (globalThis as any).__aquariusDevKey;
}

export function setDevKey(privateKey: `0x${string}` | undefined) {
  devPrivateKey = privateKey;

  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__aquariusDevKey = privateKey;
  }
}
