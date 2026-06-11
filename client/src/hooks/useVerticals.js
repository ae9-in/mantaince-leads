import { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios.js';
import toast from 'react-hot-toast';

export const useVerticals = () => {
  const [verticals, setVerticals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVerticals = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/v1/verticals');
      setVerticals(response.data.data);
    } catch (err) {
      toast.error('Failed to load verticals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerticals();
  }, [fetchVerticals]);

  return { verticals, loading, refetch: fetchVerticals };
};
