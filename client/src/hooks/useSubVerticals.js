import { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios.js';
import toast from 'react-hot-toast';

export const useSubVerticals = (verticalId) => {
  const [subVerticals, setSubVerticals] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSubVerticals = useCallback(async () => {
    if (!verticalId) return;
    setLoading(true);
    try {
      const response = await axios.get(`/api/v1/verticals/${verticalId}/sub-verticals`);
      setSubVerticals(response.data.data);
    } catch (err) {
      toast.error('Failed to load sub-verticals');
    } finally {
      setLoading(false);
    }
  }, [verticalId]);

  useEffect(() => {
    fetchSubVerticals();
  }, [fetchSubVerticals]);

  return { subVerticals, loading, refetch: fetchSubVerticals };
};
