import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { shouldShowOnThisDay } from '../services/displayPreferences.js';

export function useOnThisDayVisibilityViewModel() {
  const { settings } = useSettings();

  const shouldShowOnThisDayWidget = useMemo(() => (
    shouldShowOnThisDay(settings)
  ), [settings]);

  const onThisDayVisibilityControllerProps = useMemo(() => ({
    shouldShowOnThisDayWidget,
  }), [shouldShowOnThisDayWidget]);

  return {
    onThisDayVisibilityControllerProps,
  };
}

export default useOnThisDayVisibilityViewModel;
