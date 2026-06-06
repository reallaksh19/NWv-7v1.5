import { useState, useCallback } from 'react';
import { fetchTopicNews } from '../services/topicService.js';
import { withTimeout } from '../utils/withTimeout.js';
import { useMountedRef } from '../hooks/useMountedRef.js';

const TOPIC_TIMEOUT_MS = 12000;

export function useTopicDetailViewModel(topic) {
  const mountedRef = useMountedRef();

  const [state, setState] = useState({
    articles: [],
    loading: Boolean(topic),
    error: null,
    envelope: null,
  });

  const fetch = useCallback(async () => {
    if (!topic) return;

    if (mountedRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    try {
      const env = await withTimeout(fetchTopicNews(topic), TOPIC_TIMEOUT_MS, {
        label: `fetchTopicNews(${topic})`,
      });

      if (mountedRef.current) {
        if (env.ok) {
          setState({
            articles: Array.isArray(env.data) ? env.data : [],
            loading: false,
            error: null,
            envelope: env,
          });
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            error: env.error || 'Topic refresh failed',
            envelope: env,
          }));
        }
      }

      return env;
    } catch (error) {
      const message = error?.message || String(error);

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: message,
        }));
      }
    }
  }, [topic, mountedRef]);

  const retry = useCallback(() => fetch(), [fetch]);

  return {
    ...state,
    fetch,
    retry,
  };
}
