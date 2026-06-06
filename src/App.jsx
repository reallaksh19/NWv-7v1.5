/* eslint-disable */
import React, { Suspense, useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import BottomNav from './components/BottomNav';
import ScrollToTop from './components/ScrollToTop';
import DebugConsole from './components/DebugConsole';
import OnThisDayVisibilityController from './components/settings/OnThisDayVisibilityController.jsx';
import { useOnThisDayVisibilityViewModel } from './viewModels/useOnThisDayVisibilityViewModel';
import { WeatherProvider, useWeather } from './context/WeatherContext';
import { NewsProvider, useNews } from './context/NewsContext';
import { MarketProvider } from './context/MarketContext';
import { SettingsProvider } from './context/SettingsContext';
import { SegmentProvider } from './context/SegmentContext';
import { TopicProvider } from './context/TopicContext';
import './index.css';
import './styles/desktopRevamp.css';
import './styles/desktopPolish.css';
import './styles/weatherProfessionalTheme.css';

const MainPage = React.lazy(() => import('./pages/MainPage'));
const UpAheadPage = React.lazy(() => import('./pages/UpAheadPage'));
const MyPlannerPage = React.lazy(() => import('./pages/MyPlannerPage'));
const WeatherPage = React.lazy(() => import('./pages/WeatherPage'));
const MarketPage = React.lazy(() => import('./pages/MarketPage'));
const TechSocialPage = React.lazy(() => import('./pages/TechSocialPage'));
const NewspaperPage = React.lazy(() => import('./pages/NewspaperPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const RefreshPage = React.lazy(() => import('./pages/RefreshPage'));
const FollowingPage = React.lazy(() => import('./pages/FollowingPage'));
const TopicDetail = React.lazy(() => import('./pages/TopicDetail'));
const MorePage = React.lazy(() => import('./pages/MorePage'));
const InsightPage = React.lazy(() => import('./pages/InsightPage'));
const DataHealthPage = React.lazy(() => import('./pages/DataHealthPage'));

/**
 * Global Progress Bar
 * "Deep Architect Mode" - High visibility, smooth animation, top of screen.
 */
const GlobalLoader = () => {
  const { loading: newsLoading } = useNews();
  const { loading: weatherLoading } = useWeather();
  const isLoading = newsLoading || weatherLoading;
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer;

    if (isLoading) {
      setTimeout(() => setVisible(true), 0);
      setProgress(10);

      timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          const increment = Math.max(1, (90 - prev) / 10);
          return prev + increment;
        });
      }, 200);
    } else {
      setProgress(100);

      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 400);
    }

    return () => clearInterval(timer);
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      zIndex: 100000,
      pointerEvents: 'none'
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #00D4AA, #58A6FF, #F0883E)',
        boxShadow: '0 0 10px rgba(0, 212, 170, 0.5)',
        transition: 'width 0.2s ease-out',
        borderRadius: '0 2px 2px 0'
      }} />
    </div>
  );
};

function OnThisDayVisibilityBinding() {
  const {
    onThisDayVisibilityControllerProps,
  } = useOnThisDayVisibilityViewModel();

  return (
    <OnThisDayVisibilityController
      {...onThisDayVisibilityControllerProps}
    />
  );
}

function App() {
  console.log('[App] Rendering root component...');

  return (
    <SettingsProvider>
      <SegmentProvider>
        <WeatherProvider lazy={true}>
          <NewsProvider>
            <MarketProvider>
              <TopicProvider>
                <HashRouter>
                  <ScrollToTop />
                  <GlobalLoader />
                  <DebugConsole />
                  <OnThisDayVisibilityBinding />

                  <div className="app app-shell">
                    <Suspense fallback={<div className="route-loader" role="status" aria-label="Loading page" />}>
                      <Routes>
                        <Route
                          path="/"
                          element={
                            <ErrorBoundary label="Main">
                              <MainPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/insight"
                          element={
                            <ErrorBoundary label="Insight">
                              <InsightPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/markets"
                          element={
                            <ErrorBoundary label="Markets">
                              <MarketPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/up-ahead"
                          element={
                            <ErrorBoundary label="Up Ahead">
                              <UpAheadPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/my-planner"
                          element={
                            <ErrorBoundary label="My Planner">
                              <MyPlannerPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/more"
                          element={
                            <ErrorBoundary label="More">
                              <MorePage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/weather"
                          element={
                            <ErrorBoundary label="Weather">
                              <WeatherPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/tech-social"
                          element={
                            <ErrorBoundary label="Buzz Hub">
                              <TechSocialPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/newspaper"
                          element={
                            <ErrorBoundary label="Newspaper">
                              <NewspaperPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/settings"
                          element={
                            <ErrorBoundary label="Settings">
                              <SettingsPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/refresh"
                          element={
                            <ErrorBoundary label="Refresh">
                              <RefreshPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/following"
                          element={
                            <ErrorBoundary label="Following">
                              <FollowingPage />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/following/:topicId"
                          element={
                            <ErrorBoundary label="Topic Detail">
                              <TopicDetail />
                            </ErrorBoundary>
                          }
                        />

                        <Route
                          path="/data-health"
                          element={
                            <ErrorBoundary label="Data Health">
                              <DataHealthPage />
                            </ErrorBoundary>
                          }
                        />
                      </Routes>
                    </Suspense>

                    <BottomNav />
                  </div>
                </HashRouter>
              </TopicProvider>
            </MarketProvider>
          </NewsProvider>
        </WeatherProvider>
      </SegmentProvider>
    </SettingsProvider>
  );
}

export default App;
