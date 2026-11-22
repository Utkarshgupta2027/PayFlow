/**
 * Unit tests for Frontend Offline Crypto and Token Validation Logic
 * ───────────────────────────────────────────────────────────────────────────
 * Runs directly on Node.js using standard WebCrypto (globalThis.crypto.subtle)
 * and assert module.
 */

import assert from 'node:assert';
import {
  generateDeviceKeyPair,
  signData,
  verifyData,
  canonicalCertificateString,
  canonicalTokenString,
  signToken,
  verifyToken,
  verifyCertificate,
  base64ToArrayBuffer,
  arrayBufferToBase64,
  DEFAULT_SERVER_PUBLIC_KEY,
} from './src/offline/crypto.js';

// Polyfill window for Node environment
if (typeof window === 'undefined') {
  globalThis.window = { crypto: globalThis.crypto };
}

async function runTests() {
  console.log('--- Starting Offline Crypto & Token Validation Tests ---');

  // Test 1: Base64 helper conversion round-trip
  {
    const original = 'Hello PayFlow Offline World 12345!@#$%';
    const buffer = new TextEncoder().encode(original).buffer;
    const b64 = arrayBufferToBase64(buffer);
    const convertedBuffer = base64ToArrayBuffer(b64);
    const decoded = new TextDecoder().decode(convertedBuffer);
    assert.strictEqual(decoded, original, 'Base64 round-trip conversion should match original');
    console.log('✓ Test 1 Passed: Base64 conversion round-trip');
  }

  // Test 2: Device KeyPair Generation (ECDSA P-256)
  let deviceKey;
  {
    deviceKey = await generateDeviceKeyPair();
    assert(deviceKey.privateKey, 'Private key must be defined');
    assert(deviceKey.publicKey, 'Public key string must be defined');
    assert.strictEqual(deviceKey.privateKey.extractable, false, 'Private key MUST be non-extractable');
    assert.strictEqual(deviceKey.privateKey.algorithm.name, 'ECDSA', 'Key algorithm must be ECDSA');
    assert.strictEqual(deviceKey.privateKey.algorithm.namedCurve, 'P-256', 'Curve must be P-256');
    console.log('✓ Test 2 Passed: ECDSA P-256 non-extractable device key pair generated');
  }

  // Test 3: Sign and Verify Payment Token
  const validToken = {
    tokenId: 'tok-test-001',
    certId: 'cert-test-456',
    senderId: 10,
    receiverId: 20,
    amount: 150.0,
    counter: 1,
    timestamp: 1732262400000,
  };

  let tokenSignature;
  {
    tokenSignature = await signToken(deviceKey.privateKey, validToken);
    assert(tokenSignature, 'Signature must be generated');
    assert.strictEqual(typeof tokenSignature, 'string', 'Signature must be a base64 string');

    const isValid = await verifyToken(deviceKey.publicKey, validToken, tokenSignature);
    assert.strictEqual(isValid, true, 'Valid token signature should verify successfully');
    console.log('✓ Test 3 Passed: Token signed and verified successfully');
  }

  // Test 4: Tampered Token Detection
  {
    // Tampered amount
    const tamperedAmount = { ...validToken, amount: 999.0 };
    const isAmountValid = await verifyToken(deviceKey.publicKey, tamperedAmount, tokenSignature);
    assert.strictEqual(isAmountValid, false, 'Tampered amount must fail verification');

    // Tampered receiver
    const tamperedReceiver = { ...validToken, receiverId: 99 };
    const isReceiverValid = await verifyToken(deviceKey.publicKey, tamperedReceiver, tokenSignature);
    assert.strictEqual(isReceiverValid, false, 'Tampered receiver must fail verification');

    // Tampered counter
    const tamperedCounter = { ...validToken, counter: 5 };
    const isCounterValid = await verifyToken(deviceKey.publicKey, tamperedCounter, tokenSignature);
    assert.strictEqual(isCounterValid, false, 'Tampered counter must fail verification');
    console.log('✓ Test 4 Passed: All tampered token mutations rejected');
  }

  // Test 5: Server Certificate Signature Verification
  {
    // Generate an ephemeral server key to simulate backend signing
    const serverKey = await window.crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );
    const serverSpki = await window.crypto.subtle.exportKey('spki', serverKey.publicKey);
    const serverPubBase64 = arrayBufferToBase64(serverSpki);

    const certificate = {
      certId: 'cert-alpha-1',
      userId: 10,
      publicKey: deviceKey.publicKey,
      escrowLimit: 1000.0,
      expiry: '2026-11-29T12:00:00',
    };

    const certData = canonicalCertificateString(certificate);
    const certSig = await signData(serverKey.privateKey, certData);
    certificate.signature = certSig;

    // Verify valid certificate with server public key
    const isCertValid = await verifyCertificate(certificate, serverPubBase64);
    assert.strictEqual(isCertValid, true, 'Server certificate should verify with server public key');

    // Tampered certificate escrow limit
    const tamperedCert = { ...certificate, escrowLimit: 5000.0 };
    const isTamperedValid = await verifyCertificate(tamperedCert, serverPubBase64);
    assert.strictEqual(isTamperedValid, false, 'Tampered certificate limit must fail verification');
    console.log('✓ Test 5 Passed: Server certificate verified and tampered cert rejected');
  }

  // Test 6: Token Validation Logic Rule Checks
  {
    const futureExpiry = new Date(Date.now() + 86400000).toISOString();
    const pastExpiry = new Date(Date.now() - 86400000).toISOString();

    const cert = {
      certId: 'cert-1',
      userId: 10,
      publicKey: deviceKey.publicKey,
      escrowLimit: 500.0,
      expiry: futureExpiry,
    };

    // Helper validating offline business rules
    function validateBusinessRules({ token, certificate, currentUserId, lastSeenCounter, cumulativeReceived }) {
      if (new Date(certificate.expiry).getTime() <= Date.now()) {
        throw new Error('Expired certificate');
      }
      if (certificate.userId !== token.senderId) {
        throw new Error('Sender mismatch');
      }
      if (token.receiverId !== currentUserId) {
        throw new Error('Recipient mismatch');
      }
      if (token.counter <= lastSeenCounter) {
        throw new Error('Counter replay');
      }
      if (cumulativeReceived + token.amount > certificate.escrowLimit) {
        throw new Error('Escrow exceeded');
      }
      return true;
    }

    // A: Valid case
    const validResult = validateBusinessRules({
      token: { senderId: 10, receiverId: 20, counter: 3, amount: 100 },
      certificate: cert,
      currentUserId: 20,
      lastSeenCounter: 2,
      cumulativeReceived: 100,
    });
    assert.strictEqual(validResult, true, 'Valid payment rules should pass');

    // B: Expired cert
    assert.throws(
      () => validateBusinessRules({
        token: { senderId: 10, receiverId: 20, counter: 1, amount: 50 },
        certificate: { ...cert, expiry: pastExpiry },
        currentUserId: 20,
        lastSeenCounter: 0,
        cumulativeReceived: 0,
      }),
      /Expired certificate/
    );

    // C: Recipient mismatch
    assert.throws(
      () => validateBusinessRules({
        token: { senderId: 10, receiverId: 99, counter: 1, amount: 50 },
        certificate: cert,
        currentUserId: 20, // Logged in user is 20, but token is for 99
        lastSeenCounter: 0,
        cumulativeReceived: 0,
      }),
      /Recipient mismatch/
    );

    // D: Counter replay
    assert.throws(
      () => validateBusinessRules({
        token: { senderId: 10, receiverId: 20, counter: 2, amount: 50 },
        certificate: cert,
        currentUserId: 20,
        lastSeenCounter: 2, // Last counter was already 2
        cumulativeReceived: 50,
      }),
      /Counter replay/
    );

    // E: Escrow exceeded
    assert.throws(
      () => validateBusinessRules({
        token: { senderId: 10, receiverId: 20, counter: 4, amount: 300 },
        certificate: cert, // Limit 500
        currentUserId: 20,
        lastSeenCounter: 3,
        cumulativeReceived: 350, // 350 + 300 = 650 > 500
      }),
      /Escrow exceeded/
    );

    console.log('✓ Test 6 Passed: Token validation business rules (expiry, recipient, replay, limit)');
  }

  console.log('\n===========================================');
  console.log('ALL FRONTEND OFFLINE CRYPTO TESTS PASSED!');
  console.log('===========================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

