import React from 'react';
import { FaHome } from 'react-icons/fa';
import MarketTicker from './MarketTicker';
import { toggleDevMobileViewOverride, useMediaQuery } from '../hooks/useMediaQuery';

const TimelineHeader = ({
    title,
    icon = null,
    actions,
    loadingPhase,
    marketTickerProps = null,
}) => {
    const showTitle = title !== 'Market Brief';
    const { isDevMobileView } = useMediaQuery();
    const isDevMode = import.meta.env.DEV;

    return (
        <header className="header timeline-header">
            <div className="header__identity">
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

                {showTitle && (
                    <h1
                        className="header__title"
                    >
                        {icon && <span aria-hidden="true">{icon}</span>}
                        <span>{title}</span>
                    </h1>
                )}
            </div>

            <MarketTicker
                loadingPhase={loadingPhase}
                {...(marketTickerProps || {})}
            />

            <div className="header__right">
                {actions}
            </div>
        </header>
    );
};

export default TimelineHeader;
