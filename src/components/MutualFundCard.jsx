import React, { useMemo, useState } from 'react';

const FUND_TABS = [
    { id: 'large-cap', label: 'Large Cap' },
    { id: 'mid-cap', label: 'Mid Cap' },
    { id: 'flexi-cap', label: 'Flexi Cap' },
    { id: 'value', label: 'Value' },
    { id: 'elss', label: 'ELSS' }
];

function normalizeFundType(fund = {}) {
    const explicitType = String(fund.fundType || '').toLowerCase().replace(/[_\s]+/g, '-');
    if (FUND_TABS.some((tab) => tab.id === explicitType)) return explicitType;

    // AMFI data stores fund house as `category`; classification must come from name.
    const name = String(fund.name || '').toLowerCase();

    // Debt / money-market funds don't belong in equity tabs — exclude them.
    if (/(liquid fund|overnight|money market|ultra short|low duration|short duration|medium duration|long duration|dynamic bond|credit risk|corporate bond|banking.*(psu|debt)|psu.*debt|banking.*psu|gilt|floating rate|bond fund)/.test(name)) {
        return null;
    }

    if (/(elss|tax[- ]?saver|tax[- ]?savings|long term equity)/.test(name)) return 'elss';
    if (/(value fund|contra fund|dividend yield)/.test(name)) return 'value';
    if (/(small[- ]?cap|smallcap)/.test(name)) return 'mid-cap';
    if (/(mid[- ]?cap|midcap)/.test(name)) return 'mid-cap';
    if (/(large[- ]?cap|bluechip|top[- ]?100|nifty 50|sensex|nifty50)/.test(name)) return 'large-cap';
    if (/index fund/.test(name) && !/(mid|small|next 50)/.test(name)) return 'large-cap';
    if (/(flexi[- ]?cap|multi[- ]?cap|balanced advantage|dynamic asset)/.test(name)) return 'flexi-cap';

    // Fall back to category field (may be meaningful if set explicitly by a future data source).
    const text = `${name} ${String(fund.category || '').toLowerCase()}`;
    if (/(elss|tax saver|long term equity)/.test(text)) return 'elss';
    if (/(value|contra|dividend yield)/.test(text)) return 'value';
    if (/(mid[- ]?cap|midcap|small[- ]?cap)/.test(text)) return 'mid-cap';
    if (/(large[- ]?cap|bluechip|index)/.test(text)) return 'large-cap';
    if (/(flexi[- ]?cap|multi[- ]?cap|balanced advantage)/.test(text)) return 'flexi-cap';

    return 'flexi-cap';
}

function getTabLabel(tabId) {
    return FUND_TABS.find((tab) => tab.id === tabId)?.label || 'Flexi Cap';
}

function MutualFundCard({ funds }) {
    const groupedFunds = useMemo(() => {
        const buckets = FUND_TABS.reduce((acc, tab) => {
            acc[tab.id] = [];
            return acc;
        }, {});

        (funds || []).forEach((fund) => {
            const type = normalizeFundType(fund);
            if (type && buckets[type]) {
                buckets[type].push({
                    ...fund,
                    fundType: type,
                    fundTypeLabel: getTabLabel(type)
                });
            }
        });

        return buckets;
    }, [funds]);

    const defaultTab = FUND_TABS.find((tab) => (groupedFunds[tab.id] || []).length > 0)?.id || FUND_TABS[0].id;
    const [activeTab, setActiveTab] = useState(defaultTab);

    const resolvedActiveTab = (groupedFunds[activeTab] || []).length > 0 ? activeTab : defaultTab;
    const displayFunds = groupedFunds[resolvedActiveTab] || [];

    if (!funds || funds.length === 0) {
        return (
            <div className="mf-card mf-card--empty">
                <div className="mf-card__header">
                    <span>Charts</span> Mutual Funds
                </div>
                <p className="mf-card__empty-text">NAV data unavailable</p>
            </div>
        );
    }

    return (
        <div className="mf-card">
            <div className="mf-card__header">
                <div className="mf-card__title-wrap">
                    <span>Charts</span>
                    <span className="mf-card__title">Mutual Funds</span>
                </div>
                <span className="mf-card__date">{funds[0]?.navDate || 'Latest'}</span>
            </div>

            <div className="mf-card__tabs" role="tablist" aria-label="Mutual fund types">
                {FUND_TABS.map((tab) => {
                    const count = (groupedFunds[tab.id] || []).length;
                    const active = resolvedActiveTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`mf-tab ${active ? 'mf-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span>{tab.label}</span>
                            <span className="mf-tab__count">{count}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mf-card__panel">
                {displayFunds.length > 0 ? (
                    <div className="mf-card__list">
                        {displayFunds.map((fund, idx) => {
                            const hasChange = fund.changePercent != null && Number.isFinite(Number(fund.changePercent));
                            const direction = hasChange ? fund.direction : 'neutral';

                            return (
                            <div key={fund.code || `${fund.name}-${idx}`} className="mf-fund">
                                <div className="mf-fund__info">
                                    <div className="mf-fund__name">{fund.name || '—'}</div>
                                    <div className="mf-fund__category">
                                        {fund.category || ''}
                                        {fund.fundHouse ? ` · ${fund.fundHouse}` : ''}
                                    </div>
                                    <div className="mf-fund__badge">{fund.fundTypeLabel || getTabLabel(fund.fundType)}</div>
                                </div>
                                <div className="mf-fund__nav">
                                    <div className="mf-fund__value">₹{fund.nav != null ? fund.nav : '—'}</div>
                                    <div className={`mf-fund__change mf-fund__change--${direction}`}>
                                        {fund.direction === 'up' ? '▲' : '▼'} {fund.changePercent != null ? `${Number(fund.changePercent).toFixed(2)}%` : '—'}
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mf-card__empty-state">
                        No funds currently mapped to {getTabLabel(activeTab)}.
                    </div>
                )}
            </div>
        </div>
    );
}

export default MutualFundCard;
