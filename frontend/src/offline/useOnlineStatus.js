import { useState, useEffect, useCallback } from 'react';
import { syncPendingTokens } from './offlineService.js';
import { getTokensAwaitingSettlement } from './db.js';

/**
 * React hook tracking online/offline state and coordinating automatic sync.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const tokens = await getTokensAwaitingSettlement();
      setPendingCount(tokens ? tokens.length : 0);
    } catch {
      // IndexedDB might not be open yet
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return null;
    setIsSyncing(true);
    try {
      const result = await syncPendingTokens();
      setLastSyncResult(result);
      await refreshPendingCount();
      return result;
    } catch (err) {
      console.warn('[useOnlineStatus] Sync error:', err);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync pending payments upon reconnecting online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleSyncCompleted = () => {
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sync-completed', handleSyncCompleted);

    // Initial check on mount if online
    if (navigator.onLine) {
      triggerSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sync-completed', handleSyncCompleted);
    };
  }, [triggerSync, refreshPendingCount]);

  return {
    isOnline,
    isSyncing,
    lastSyncResult,
    pendingCount,
    triggerSync,
    refreshPendingCount,
  };
}

export default useOnlineStatus;

