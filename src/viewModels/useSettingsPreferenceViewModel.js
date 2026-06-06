import { useCallback, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import {
  buildDisplaySettings,
  shouldShowOnThisDay,
} from '../services/displayPreferences.js';
import {
  buildTravelLocationSettings,
  getTravelLocationOptions,
  getTravelLocationProfile,
} from '../services/travelLocationProfile.js';

function safeErrorMessage(error) {
  return error?.message || String(error);
}

export function useSettingsPreferenceViewModel() {
  const { settings: prefs, updateSettings } = useSettings();

  const showOnThisDay = useMemo(() => (
    shouldShowOnThisDay(prefs)
  ), [prefs]);

  const toggleOnThisDay = useCallback((nextValue) => {
    try {
      if (typeof updateSettings !== 'function') {
        return {
          ok: false,
          error: 'Settings update handler unavailable.',
        };
      }

      updateSettings(buildDisplaySettings(prefs, {
        showOnThisDay: Boolean(nextValue),
      }));

      return { ok: true };
    } catch (error) {
      console.warn('[useSettingsPreferenceViewModel] display preference update failed', {
        message: safeErrorMessage(error),
      });

      return {
        ok: false,
        error: safeErrorMessage(error),
      };
    }
  }, [prefs, updateSettings]);

  const travelProfile = useMemo(() => (
    getTravelLocationProfile(prefs)
  ), [prefs]);

  const travelOptions = useMemo(() => (
    getTravelLocationOptions()
  ), []);

  const updateTravelLocation = useCallback((patch) => {
    try {
      if (typeof updateSettings !== 'function') {
        return {
          ok: false,
          error: 'Settings update handler unavailable.',
        };
      }

      updateSettings(buildTravelLocationSettings(prefs, patch));

      return { ok: true };
    } catch (error) {
      console.warn('[useSettingsPreferenceViewModel] travel location update failed', {
        message: safeErrorMessage(error),
      });

      return {
        ok: false,
        error: safeErrorMessage(error),
      };
    }
  }, [prefs, updateSettings]);

  const displayPreferencesProps = useMemo(() => ({
    showOnThisDay,
    onToggleOnThisDay: toggleOnThisDay,
  }), [showOnThisDay, toggleOnThisDay]);

  const travelLocationSettingsProps = useMemo(() => ({
    profile: travelProfile,
    options: travelOptions,
    onUpdateTravelLocation: updateTravelLocation,
  }), [
    travelProfile,
    travelOptions,
    updateTravelLocation,
  ]);

  return {
    displayPreferencesProps,
    travelLocationSettingsProps,
  };
}

export const __settingsPreferenceViewModelInternalsForTest = {
  safeErrorMessage,
};
