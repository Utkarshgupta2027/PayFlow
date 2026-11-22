/**
 * IndexedDB persistence layer for PayFlow Offline Payments
 * ───────────────────────────────────────────────────────────────────────────
 * Manages local storage for:
 *  - Device ECDSA CryptoKey (non-extractable) & public key
 *  - Active server certificate
 *  - Sender counter (strictly increasing)
 *  - Pending tokens (received while offline, awaiting sync)
 *  - Seen token IDs and last seen counters (prevent local replay)
 *  - Sent tokens history
 */

import { openDB } from 'idb';

const DB_NAME = 'payflow_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: Device cryptographic keys (CryptoKey non-extractable)
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }

        // Store 2: Active server-signed certificate
        if (!db.objectStoreNames.contains('certificate')) {
          db.createObjectStore('certificate');
        }

        // Store 3: Strictly increasing sender counters per cert
        if (!db.objectStoreNames.contains('counter')) {
          db.createObjectStore('counter');
        }

        // Store 4: Received payment tokens pending settlement
        if (!db.objectStoreNames.contains('pendingTokens')) {
          const store = db.createObjectStore('pendingTokens', { keyPath: 'tokenId' });
          store.createIndex('status', 'status');
          store.createIndex('certId', 'certId');
          store.createIndex('senderId', 'senderId');
        }

        // Store 5: Seen token IDs (to reject local replay attacks)
        if (!db.objectStoreNames.contains('seenTokenIds')) {
          db.createObjectStore('seenTokenIds', { keyPath: 'tokenId' });
        }

        // Store 6: Last seen counters per cert (for receiver verification)
        if (!db.objectStoreNames.contains('lastSeenCounters')) {
          db.createObjectStore('lastSeenCounters');
        }

        // Store 7: Sent tokens log (receipts on sender device)
        if (!db.objectStoreNames.contains('sentTokens')) {
          const sentStore = db.createObjectStore('sentTokens', { keyPath: 'tokenId' });
          sentStore.createIndex('certId', 'certId');
          sentStore.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// ─── Key Pair Operations ──────────────────────────────────────────────────────

export async function saveKeyPair(privateKey, publicKey) {
  const db = await getDb();
  await db.put('keys', { privateKey, publicKey }, 'device_keypair');
}

export async function getKeyPair() {
  const db = await getDb();
  return (await db.get('keys', 'device_keypair')) || null;
}

export async function clearKeyPair() {
  const db = await getDb();
  await db.delete('keys', 'device_keypair');
}

// ─── Certificate Operations ───────────────────────────────────────────────────

export async function saveCertificate(cert) {
  const db = await getDb();
  await db.put('certificate', cert, 'active_cert');
}

export async function getCertificate() {
  const db = await getDb();
  return (await db.get('certificate', 'active_cert')) || null;
}

export async function clearCertificate() {
  const db = await getDb();
  await db.delete('certificate', 'active_cert');
}

// ─── Counter Operations (Sender) ──────────────────────────────────────────────

export async function getNextCounter(certId) {
  const db = await getDb();
  const tx = db.transaction('counter', 'readwrite');
  const store = tx.objectStore('counter');
  const current = (await store.get(certId)) || 0;
  const next = current + 1;
  await store.put(next, certId);
  await tx.done;
  return next;
}

export async function getCurrentCounter(certId) {
  const db = await getDb();
  return (await db.get('counter', certId)) || 0;
}

export async function resetCounter(certId) {
  const db = await getDb();
  await db.put('counter', 0, certId);
}

// ─── Receiver Verification (Seen Token IDs & Counters) ────────────────────────

export async function isTokenSeen(tokenId) {
  const db = await getDb();
  const record = await db.get('seenTokenIds', tokenId);
  return Boolean(record);
}

export async function markTokenSeen(tokenId, certId, amount, counter) {
  const db = await getDb();
  await db.put('seenTokenIds', {
    tokenId,
    certId,
    amount,
    counter,
    seenAt: Date.now(),
  });
}

export async function getLastSeenCounter(certId) {
  const db = await getDb();
  return (await db.get('lastSeenCounters', certId)) || 0;
}

export async function setLastSeenCounter(certId, counter) {
  const db = await getDb();
  await db.put('lastSeenCounters', counter, certId);
}

export async function getCumulativeReceivedAmountForCert(certId) {
  const db = await getDb();
  const tx = db.transaction('pendingTokens', 'readonly');
  const index = tx.objectStore('pendingTokens').index('certId');
  const tokens = await index.getAll(certId);
  return tokens.reduce((sum, t) => sum + (t.amount || 0), 0);
}

// ─── Pending Tokens Operations (Receiver Settlement) ──────────────────────────

export async function savePendingToken(tokenData) {
  const db = await getDb();
  const entry = {
    ...tokenData,
    status: tokenData.status || 'PENDING_SETTLEMENT',
    receivedAt: tokenData.receivedAt || Date.now(),
  };
  await db.put('pendingTokens', entry);
  return entry;
}

export async function getPendingTokens() {
  const db = await getDb();
  return await db.getAll('pendingTokens');
}

export async function getTokensAwaitingSettlement() {
  const db = await getDb();
  const tx = db.transaction('pendingTokens', 'readonly');
  const index = tx.objectStore('pendingTokens').index('status');
  return await index.getAll('PENDING_SETTLEMENT');
}

export async function updatePendingTokenStatus(tokenId, status, reason = null) {
  const db = await getDb();
  const token = await db.get('pendingTokens', tokenId);
  if (token) {
    token.status = status;
    if (reason) token.rejectReason = reason;
    token.updatedAt = Date.now();
    await db.put('pendingTokens', token);
  }
}

export async function removePendingToken(tokenId) {
  const db = await getDb();
  await db.delete('pendingTokens', tokenId);
}

// ─── Sent Tokens Operations (Sender History) ──────────────────────────────────

export async function saveSentToken(token) {
  const db = await getDb();
  await db.put('sentTokens', {
    ...token,
    createdAt: Date.now(),
  });
}

export async function getSentTokens() {
  const db = await getDb();
  const tokens = await db.getAll('sentTokens');
  return tokens.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCumulativeSentAmountForCert(certId) {
  const db = await getDb();
  const tx = db.transaction('sentTokens', 'readonly');
  const index = tx.objectStore('sentTokens').index('certId');
  const tokens = await index.getAll(certId);
  return tokens.reduce((sum, t) => sum + (t.amount || 0), 0);
}

// ─── Clear All Offline Data (e.g. Logout / Reset) ──────────────────────────────

export async function clearAllOfflineData() {
  const db = await getDb();
  const stores = ['keys', 'certificate', 'counter', 'pendingTokens', 'seenTokenIds', 'lastSeenCounters', 'sentTokens'];
  for (const store of stores) {
    await db.clear(store);
  }
}

