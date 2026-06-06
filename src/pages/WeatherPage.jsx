import React, { useCallback, useEffect } from 'react';
import WeatherStickyHeader from '../components/WeatherStickyHeader';
import DetailedWeatherCard from '../components/DetailedWeatherCard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import WeatherLocationManager from '../components/weather/WeatherLocationManager.jsx';
import WeeklyWeatherForecast from '../components/weather/WeeklyWeatherForecast.jsx';
import WeatherCityComparison from '../components/weather/WeatherCityComparison.jsx';
import WeatherPlanningSummary from '../components/weather/WeatherPlanningSummary.jsx';
import GradeBadge from '../components/audit/GradeBadge.jsx';
import { useWeatherTabViewModel } from '../viewModels/useWeatherTabViewModel';

/**
 * Weather Page
 * Dedicated page for detailed weather forecast with sticky header.
 * Release 6K: page is render-focused; Weather ViewModel owns context/settings/storage/audit.
 */
function WeatherPage() {
  const { isDesktop } = useMediaQuery();

  const {
    weatherData,
    activeCity,
    weatherTabAudit,
    loading,
    error,
    hasRenderableWeatherData,
    refreshWeather,
    locationManagerProps,
    detailedWeatherCardProps,
    stickyHeaderProps,
    cityComparisonProps,
    planningSummaryProps,
    weeklyForecastProps,
  } = useWeatherTabViewModel();

  useEffect(() => {
    if (!loading && hasRenderableWeatherData) {
      const firstCityData = Object.values(weatherData)[0];

      if (import.meta.env.DEV) {
        console.log('[Phase 6 Diagnostics]', {
          page: 'weather',
          activeCity,
          sourceMode: firstCityData?.sourceMode || 'none',
        });
      }
    }
  }, [activeCity, hasRenderableWeatherData, loading, weatherData]);

  const handleRefresh = useCallback(async () => (
    refreshWeather(true)
  ), [refreshWeather]);

  const { pullDistance } = usePullToRefresh(handleRefresh);

  if (loading && !hasRenderableWeatherData) {
    return (
      <div
        className="page-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <div className="loading">
          <div className="loading__spinner"></div>
          <span>Loading Forecast...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: 0 }}>
      <GradeBadge
        audit={weatherTabAudit}
        label="Weather tab quality grade"
        position="below-header"
        topOffset="74px"
        compact={true}
      />

      <div
        style={{
          height: `${pullDistance}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
          color: 'var(--accent-primary)',
          fontSize: '0.8rem',
          transition: pullDistance === 0 ? 'height 0.3s ease' : 'none',
        }}
      >
        {pullDistance > 40 ? 'Release to refresh' : 'Pull to refresh'}
      </div>

      {hasRenderableWeatherData && (
        <WeatherStickyHeader
          {...stickyHeaderProps}
          isDesktop={isDesktop}
        />
      )}

      <main className="main-content" style={{ padding: 0, marginTop: 0 }}>
        {error && (
          <div className="topline" style={{ borderLeftColor: 'var(--accent-danger)', margin: '16px' }}>
            <div className="topline__label" style={{ color: 'var(--accent-danger)' }}>Error</div>
            <div className="topline__text">Failed to update weather. Showing cached data.</div>
          </div>
        )}

        <WeatherLocationManager {...locationManagerProps} />

        {hasRenderableWeatherData ? (
          <>
            <DetailedWeatherCard {...detailedWeatherCardProps} />
            <WeatherCityComparison {...cityComparisonProps} />
            <WeatherPlanningSummary {...planningSummaryProps} />
            <WeeklyWeatherForecast {...weeklyForecastProps} />
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state__icon">☁️</div>
            <p>Weather data unavailable.</p>
            <button onClick={handleRefresh} className="btn btn--secondary mt-md">Retry</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default WeatherPage;
