/** Base64 helpers for storing typed arrays inside the JSON project file. */

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeFloat32(arr: Float32Array): string {
  return bytesToBase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}

export function decodeFloat32(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
}

export function encodeUint32(arr: Uint32Array): string {
  return bytesToBase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}

export function decodeUint32(b64: string): Uint32Array {
  const bytes = base64ToBytes(b64);
  return new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
}
