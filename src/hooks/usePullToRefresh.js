import { useState, useCallback, useEffect, useRef } from 'react';

export function usePullToRefresh(onRefresh, threshold = 60) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const refreshingRef = useRef(false);

  const triggerRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullDistance(0);
      }, 100);
    }
  }, [onRefresh]);

  useEffect(() => {
    const handleTouchStart = (e) => {
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (window.scrollY === 0 && startYRef.current > 0) {
        const y = e.touches[0].clientY;
        const dist = y - startYRef.current;
        if (dist > 0) {
          if (e.cancelable) e.preventDefault();
          setPullDistance(Math.min(dist * 0.5, threshold * 1.5));
        }
      }
    };

    const handleTouchEnd = () => {
      setPullDistance((prev) => {
        if (prev >= threshold && !refreshingRef.current) {
          triggerRefresh();
        }
        return 0;
      });
      startYRef.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [threshold, triggerRefresh]);

  return { pullDistance, refreshing, triggerRefresh, setPullDistance };
}
