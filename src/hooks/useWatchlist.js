import { useState } from 'react';
import {
    makeStorageWriteFailure,
    safeGetJson,
    safeSetJson,
} from '../data/safeStorage.js';

export function useWatchlist(storageKey = 'ua_watchlist') {
    const [watchlist, setWatchlist] = useState(() => {
        const stored = safeGetJson(storageKey, []);
        return Array.isArray(stored) ? stored : [];
    });
    const [watchlistError, setWatchlistError] = useState('');

    const toggleWatchlist = (id) => {
        let newWatchlist;
        if (watchlist.includes(id)) {
            newWatchlist = watchlist.filter(itemId => itemId !== id);
        } else {
            newWatchlist = [...watchlist, id];
        }

        if (!safeSetJson(storageKey, newWatchlist)) {
            const failure = makeStorageWriteFailure(storageKey);
            setWatchlistError(failure.error);
            return failure;
        }

        setWatchlist(newWatchlist);
        setWatchlistError('');
        return { ok: true, watchlist: newWatchlist };
    };

    const isWatched = (id) => watchlist.includes(id);

    return { watchlist, toggleWatchlist, isWatched, watchlistError };
}
