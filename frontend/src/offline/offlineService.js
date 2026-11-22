/**
 * PayFlow Offline Payments Service
 * ───────────────────────────────────────────────────────────────────────────
 * Orchestrates:
 *  - Online wallet enabling, top-ups, releasing, revoking
 *  - Offline payment token creation (sender)
 *  - Offline token validation and local storage (receiver)
 *  - Automatic and manual background sync when online
 */

import { apiFetch } from '../api.js';
import * as crypto from './crypto.js';
import * as db from './db.js';

/**
 * Enable offline mode online: generates device keypair, moves funds to escrow,
 * receives server-signed certificate and persists to IndexedDB.
 */
export async function enableOfflineWallet(amount, transactionPin) {
  // 1. Generate or retrieve existing device ECDSA keypair
  let keyPair = await db.getKeyPair();
  if (!keyPair) {
    keyPair = await crypto.generateDeviceKeyPair();
    await db.saveKeyPair(keyPair.privateKey, keyPair.publicKey);
  }

  // 2. Call backend /offline/enable
  const res = await apiFetch('/offline/enable', {
    method: 'POST',
    body: JSON.stringify({
      publicKey: keyPair.publicKey,
      amount: Number(amount),
      transactionPin,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to enable offline wallet');
  }

  // 3. Persist certificate to IndexedDB
  if (data.certificate) {
    await db.saveCertificate(data.certificate);
    await db.resetCounter(data.certificate.certId);
  }

  return data;
}

/**
 * Top up active offline escrow from main wallet.
 */
export async function topUpOfflineWallet(amount, transactionPin) {
  const res = await apiFetch('/offline/topup', {
    method: 'POST',
    body: JSON.stringify({
      amount: Number(amount),
      transactionPin,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to top up offline escrow');
  }

  if (data.certificate) {
    await db.saveCertificate(data.certificate);
  }

  return data;
}

/**
 * Release remaining unused escrow back to main balance.
 */
export async function releaseOfflineWallet(transactionPin) {
  const res = await apiFetch('/offline/release', {
    method: 'POST',
    body: JSON.stringify({ transactionPin }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to release escrow funds');
  }

  await db.clearCertificate();
  return data;
}

/**
 * Revoke offline wallet (lost-device flow or reset).
 */
export async function revokeOfflineWallet(userId = null) {
  const res = await apiFetch('/offline/revoke', {
    method: 'POST',
    body: JSON.stringify(userId ? { userId } : {}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to revoke offline wallet');
  }

  await db.clearCertificate();
  return data;
}

/**
 * Refresh offline status from server when online.
 */
export async function refreshOfflineStatus() {
  try {
    const res = await apiFetch('/offline/status');
    if (res.ok) {
      const data = await res.json();
      if (data.active && data.certificate) {
        await db.saveCertificate(data.certificate);
      } else {
        await db.clearCertificate();
      }
      return data;
    }
  } catch (err) {
    console.warn('[OfflineService] Failed to fetch server status (offline?):', err);
  }
  return null;
}

/**
 * Create a signed payment token offline (Sender).
 */
export async function createOfflinePaymentToken({ receiverId, amount, currentUserId }) {
  const cert = await db.getCertificate();
  if (!cert) {
    throw new Error('No active offline wallet. Please enable offline payments while online first.');
  }

  const expiryTime = new Date(cert.expiry).getTime();
  if (Date.now() >= expiryTime) {
    throw new Error('Offline certificate has expired. Please reconnect online to renew.');
  }

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    throw new Error('Amount must be greater than 0.');
  }

  const numReceiverId = Number(receiverId);
  if (!numReceiverId || isNaN(numReceiverId)) {
    throw new Error('Valid Receiver ID is required.');
  }
  if (numReceiverId === Number(currentUserId)) {
    throw new Error('Cannot send payment to yourself.');
  }

  // Check cumulative sent tokens for this certificate
  const alreadySent = await db.getCumulativeSentAmountForCert(cert.certId);
  const remaining = cert.escrowLimit - alreadySent;
  if (numAmount > remaining) {
    throw new Error(`Insufficient offline escrow limit. Remaining: ₹${remaining.toFixed(2)}, Requested: ₹${numAmount.toFixed(2)}`);
  }

  const keyPair = await db.getKeyPair();
  if (!keyPair || !keyPair.privateKey) {
    throw new Error('Device signing key not found on this device.');
  }

  // Atomically increment counter for this cert
  const counter = await db.getNextCounter(cert.certId);
  const tokenId = crypto.randomUUID ? crypto.randomUUID() : `tok-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = Date.now();

  const token = {
    tokenId,
    certId: cert.certId,
    senderId: Number(currentUserId),
    receiverId: numReceiverId,
    amount: numAmount,
    counter,
    timestamp,
  };

  // Sign token using device non-extractable private key
  const signature = await crypto.signToken(keyPair.privateKey, token);
  token.signature = signature;

  // Save to local sent log
  await db.saveSentToken(token);

  // Return payload bundled with certificate for receiver validation
  return {
    token,
    certificate: cert,
  };
}

/**
 * Verify incoming token and store as PENDING_SETTLEMENT (Receiver).
 */
export async function verifyAndStoreIncomingToken(payloadInput, currentUserId) {
  let payload = payloadInput;
  if (typeof payloadInput === 'string') {
    try {
      payload = JSON.parse(payloadInput.trim());
    } catch {
      throw new Error('Invalid payment data: could not parse QR or text payload.');
    }
  }

  if (!payload || !payload.token || !payload.certificate) {
    throw new Error('Malformed payment data: missing token or certificate.');
  }

  const { token, certificate } = payload;

  // 1. Verify Server Certificate Signature
  const isCertValid = await crypto.verifyCertificate(certificate);
  if (!isCertValid) {
    throw new Error('Security Error: Server certificate signature verification failed! Possible forged certificate.');
  }

  // 2. Certificate Expiry Check
  const expiryTime = new Date(certificate.expiry).getTime();
  if (Date.now() >= expiryTime) {
    throw new Error(`Expired Certificate: Certificate expired on ${new Date(certificate.expiry).toLocaleString()}`);
  }

  // 3. Sender Verification
  if (certificate.userId !== token.senderId) {
    throw new Error('Certificate mismatch: Token sender does not match certificate owner.');
  }

  // 4. Recipient Verification
  if (Number(token.receiverId) !== Number(currentUserId)) {
    throw new Error(`Recipient mismatch: This payment was intended for User #${token.receiverId}, not your account (#${currentUserId}).`);
  }

  // 5. Duplicate Check
  const alreadySeen = await db.isTokenSeen(token.tokenId);
  if (alreadySeen) {
    throw new Error(`Duplicate Payment: Token ${token.tokenId} has already been scanned and recorded.`);
  }

  // 6. Token Signature Verification
  const isTokenSigValid = await crypto.verifyToken(certificate.publicKey, token, token.signature);
  if (!isTokenSigValid) {
    throw new Error('Tampered Payment: Token cryptographic signature is invalid or data was altered!');
  }

  // 7. Counter Check (Strictly Increasing)
  const lastCounter = await db.getLastSeenCounter(certificate.certId);
  if (token.counter <= lastCounter) {
    throw new Error(`Counter Replay: Token counter (${token.counter}) must be greater than previous seen counter (${lastCounter}).`);
  }

  // 8. Certificate Escrow Limit Check
  const cumulativeReceived = await db.getCumulativeReceivedAmountForCert(certificate.certId);
  if (cumulativeReceived + token.amount > certificate.escrowLimit) {
    throw new Error(`Escrow Exceeded: Token amount exceeds sender's remaining certificate limit.`);
  }

  // 9. Store as PENDING_SETTLEMENT
  const storedEntry = await db.savePendingToken({
    ...token,
    certificate,
    status: 'PENDING_SETTLEMENT',
    receivedAt: Date.now(),
  });

  // Update receiver tracking
  await db.markTokenSeen(token.tokenId, certificate.certId, token.amount, token.counter);
  await db.setLastSeenCounter(certificate.certId, token.counter);

  return storedEntry;
}

/**
 * Upload pending tokens to server when online (POST /offline/sync).
 */
export async function syncPendingTokens() {
  if (!navigator.onLine) {
    return { synced: 0, reason: 'Device is offline' };
  }

  const pendingTokens = await db.getTokensAwaitingSettlement();
  if (!pendingTokens || pendingTokens.length === 0) {
    return { synced: 0, total: 0 };
  }

  const dtos = pendingTokens.map((t) => ({
    tokenId: t.tokenId,
    certId: t.certId,
    senderId: t.senderId,
    receiverId: t.receiverId,
    amount: t.amount,
    counter: t.counter,
    timestamp: t.timestamp,
    signature: t.signature,
  }));

  try {
    const res = await apiFetch('/offline/sync', {
      method: 'POST',
      body: JSON.stringify(dtos),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Sync failed with HTTP ${res.status}`);
    }

    const syncResponse = await res.json();

    // Process per-token results
    if (syncResponse.results && Array.isArray(syncResponse.results)) {
      for (const item of syncResponse.results) {
        if (item.status === 'SETTLED' || item.status === 'DUPLICATE') {
          await db.updatePendingTokenStatus(item.tokenId, 'SETTLED');
        } else if (item.status === 'REJECTED') {
          await db.updatePendingTokenStatus(item.tokenId, 'REJECTED', item.reason);
        }
      }
    }

    // Broadcast sync event to reactive components
    window.dispatchEvent(
      new CustomEvent('offline-sync-completed', { detail: syncResponse })
    );

    return syncResponse;
  } catch (err) {
    console.error('[OfflineService] Sync failed:', err);
    throw err;
  }
}

