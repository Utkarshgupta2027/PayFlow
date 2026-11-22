/**
 * WebCrypto ECDSA P-256 (secp256r1) Implementation for Offline Payments
 * ───────────────────────────────────────────────────────────────────────────
 * - Generates ECDSA P-256 key pairs with non-extractable private keys
 * - Signs payment tokens locally without internet
 * - Verifies server certificates and sender token signatures
 * - Compatible with Java backend (IEEE P1363 64-byte raw r||s format)
 */

export const DEFAULT_SERVER_PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElBZKtJ+TE9FvLwfeD0mXErHj01niLuCjdATFr5P5oXlhYYBqqgxevjH9m1MVOuVL1EOR5jVkn3TOBtfNsmUFbg==';

export function getServerPublicKey() {
  return import.meta.env?.VITE_OFFLINE_SERVER_PUBLIC_KEY || DEFAULT_SERVER_PUBLIC_KEY;
}

/**
 * Convert Base64 string to ArrayBuffer.
 */
export function base64ToArrayBuffer(base64) {
  const clean = base64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to Base64 string.
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Clean PEM headers or whitespace from key strings.
 */
export function cleanKey(key) {
  if (!key) return '';
  return key
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Generate a new ECDSA P-256 key pair.
 * The private key is non-extractable (extractable: false) so it cannot leave the device.
 */
export async function generateDeviceKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false, // NON-EXTRACTABLE
    ['sign']
  );

  // Export public key in standard X.509 SPKI Base64 format
  const spki = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(spki);

  return {
    privateKey: keyPair.privateKey,
    publicKey: publicKeyBase64,
  };
}

/**
 * Deterministic canonical string for certificate verification.
 */
export function canonicalCertificateString(cert) {
  const pub = cleanKey(cert.publicKey);
  return `${cert.certId}|${cert.userId}|${pub}|${cert.escrowLimit}|${cert.expiry}`;
}

/**
 * Deterministic canonical string for token signing & verification.
 */
export function canonicalTokenString(token) {
  const ts = token.timestamp || 0;
  return `${token.tokenId}|${token.certId}|${token.senderId}|${token.receiverId}|${token.amount}|${token.counter}|${ts}`;
}

/**
 * Sign data string with non-extractable ECDSA CryptoKey.
 * Returns Base64-encoded 64-byte raw signature.
 */
export async function signData(privateKey, dataString) {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(dataString);

  const sigBuffer = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    dataBytes
  );

  return arrayBufferToBase64(sigBuffer);
}

/**
 * Verify signature against data string using X.509 SPKI public key Base64.
 */
export async function verifyData(publicKeyBase64, dataString, signatureBase64) {
  try {
    const cleanPub = cleanKey(publicKeyBase64);
    const pubBuffer = base64ToArrayBuffer(cleanPub);

    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      pubBuffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      false,
      ['verify']
    );

    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(dataString);
    const sigBuffer = base64ToArrayBuffer(signatureBase64);

    return await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      sigBuffer,
      dataBytes
    );
  } catch (err) {
    console.warn('[OfflineCrypto] Signature verification failed:', err);
    return false;
  }
}

/**
 * Sign a payment token using the device's non-extractable private key.
 */
export async function signToken(privateKey, token) {
  const canonical = canonicalTokenString(token);
  return signData(privateKey, canonical);
}

/**
 * Verify token signature with sender's public key.
 */
export async function verifyToken(senderPublicKeyBase64, token, signatureBase64) {
  const canonical = canonicalTokenString(token);
  return verifyData(senderPublicKeyBase64, canonical, signatureBase64);
}

/**
 * Verify server certificate signature using bundled server public key.
 */
export async function verifyCertificate(cert, serverPublicKeyBase64 = null) {
  const srvPub = serverPublicKeyBase64 || getServerPublicKey();
  const canonical = canonicalCertificateString(cert);
  return verifyData(srvPub, canonical, cert.signature);
}

