import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome } from 'react-icons/fa';
import MarketTicker from './MarketTicker';
import ThemeToggle from './ThemeToggle';
import FetchModeToggle from './FetchModeToggle';
import { toggleDevMobileViewOverride, useMediaQuery } from '../hooks/useMediaQuery';

export function DataStatePill({ mode, label }) {
    if (!mode) return null;
    return <span className={`data-pill data-pill--${mode}`}>{label}</span>;
}

/**
 * Header Component with optional back navigation.
 *
 * Release 6H:
 * - Header no longer imports/calls runtimeCapabilities.
 * - Runtime badge state is supplied by parent through shellRuntimeProps.
 * - ThemeToggle and MarketTicker prop bindings from 6F/6G are preserved.
 */
function Header({
    title,
    showBack = false,
    backTo = '/',
    actions,
    pills,
    activePill,
    onPillChange,
    compact = false,
    loadingPhase,
    showMarket = false,
    marketTickerProps = null,
    themeToggleProps = null,
    shellRuntimeProps = null,
    stateLabel,
    stateType,
}) {
    const { isDesktop, isDevMobileView } = useMediaQuery();
    const isDevMode = import.meta.env.DEV;

    const getPillIcon = (pillName) => {
        if (pillName.includes('Morning')) return '🌅';
        if (pillName.includes('Midday')) return '☀️';
        if (pillName.includes('Evening')) return '🌙';
        return pillName;
    };

    return (
        <header className={`header ${compact ? 'header--compact' : ''}`}>
            {showBack ? (
                <Link to={backTo} className="header__back">
                    <span>←</span>
                    <span>{title}</span>
                </Link>
            ) : (
                <div className="header__identity">
                    {isDesktop && <ThemeToggle {...(themeToggleProps || {})} />}

                    {isDevMode && (
                        <button
                            type="button"
                            className={`header__action-btn header__dev-toggle ${isDevMobileView ? 'header__dev-toggle--active' : ''}`}
                            onClick={toggleDevMobileViewOverride}
                            title={isDevMobileView ? 'Return to desktop view' : 'Force mobile view'}
                            aria-pressed={isDevMobileView}
                        >
                            <FaHome aria-hidden="true" />
                        </button>
                    )}

                    {shellRuntimeProps?.showStaticHostBadge && (
                        <span
                            className="runtime-badge runtime-badge--icon-only"
                            title={shellRuntimeProps.staticHostBadgeTitle || 'Static-host mode is active.'}
                            aria-label={shellRuntimeProps.staticHostBadgeLabel || 'Static-host mode'}
                        >
                            {shellRuntimeProps.staticHostBadgeIcon || '📦'}
                        </span>
                    )}

                    <h1 className="header__title">
                        {title}
                    </h1>
                </div>
            )}

            {showMarket && (
                <MarketTicker
                    loadingPhase={loadingPhase}
                    {...(marketTickerProps || {})}
                />
            )}

            {pills && (
                <div className="header__pills">
                    {pills.map((pill) => (
                        <button
                            key={pill}
                            className={`time-pill time-pill--matte ${activePill === pill ? 'time-pill--active' : ''}`}
                            onClick={() => onPillChange && onPillChange(pill)}
                            title={pill}
                        >
                            {getPillIcon(pill)}
                        </button>
                    ))}
                </div>
            )}

            <div className="header__right">
                <FetchModeToggle />
                {stateLabel && <DataStatePill mode={stateType || 'live'} label={stateLabel} />}
                {actions}

                {!showBack && (
                    <Link to="/more" className="header__action-btn" title="More Options">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </Link>
                )}
            </div>
        </header>
    );
}

export default Header;
