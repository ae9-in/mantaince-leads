import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { useUiStore } from '../store/uiStore.js';
import toast from 'react-hot-toast';

export function useRealtimeAssignments() {
  const { user, accessToken } = useAuthStore();
  const { setAssignedSubVerticals, triggerLeadsRefresh } = useUiStore();

  const handleMessage = useCallback((event) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload.type === 'ASSIGNMENT_UPDATED') {
        // If it's our assignment, update the store
        if (payload.userId === user?.sub) {
          setAssignedSubVerticals(payload.assignments);
          toast.success('Your workspace assignments have been updated.', { icon: '🔄' });
        }
      } else if (payload.type === 'LEAD_MUTATED') {
        triggerLeadsRefresh();
      }
    } catch (e) {
      console.error('[SSE] Parse error:', e);
    }
  }, [user?.sub, setAssignedSubVerticals, triggerLeadsRefresh]);

  useEffect(() => {
    if (!user || !accessToken) return;

    // Pass token in query string since EventSource doesn't support headers
    const streamUrl = `/api/v1/assignments/stream?token=${accessToken}`;
    const es = new EventSource(streamUrl, { withCredentials: true });

    es.addEventListener('message', handleMessage);

    es.onerror = (err) => {
      console.warn('[SSE] Connection lost, retrying...', err);
    };

    return () => {
      es.close();
    };
  }, [user, accessToken, handleMessage]);
}
