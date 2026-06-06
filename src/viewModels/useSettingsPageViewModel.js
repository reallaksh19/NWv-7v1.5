import { useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';

export function useSettingsPageViewModel() {
  const { settings, updateSettings, reloadSettings } = useSettings();
  const runtime = getRuntimeCapabilities();

  const getBackupData = useCallback(() => ({
    settings,
    hiddenEvents: JSON.parse(localStorage.getItem('upAhead_hiddenEvents') || '[]'),
    watchlist: JSON.parse(localStorage.getItem('upAhead_watchlist') || '[]'),
    readingHistory: settings.readingHistory || [],
  }), [settings]);

  const applyImport = useCallback((imported) => {
    if (imported.settings) {
      updateSettings(imported.settings);
      if (imported.hiddenEvents) localStorage.setItem('upAhead_hiddenEvents', JSON.stringify(imported.hiddenEvents));
      if (imported.watchlist) localStorage.setItem('upAhead_watchlist', JSON.stringify(imported.watchlist));
    } else {
      updateSettings(imported);
    }
    reloadSettings();
  }, [updateSettings, reloadSettings]);

  return {
    settings,
    updateSettings,
    reloadSettings,
    isStaticHost: Boolean(runtime.isStaticHost),
    getBackupData,
    applyImport,
  };
}
