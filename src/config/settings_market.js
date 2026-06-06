export const MARKET_TRADING_HOLIDAY_CALENDAR = {
    2024: [
        '2024-01-22', '2024-01-26', '2024-03-08', '2024-03-25', '2024-03-29',
        '2024-04-11', '2024-04-17', '2024-05-01', '2024-05-20', '2024-06-17',
        '2024-07-17', '2024-08-15', '2024-10-02', '2024-11-01', '2024-11-15',
        '2024-12-25',
    ],
    2025: [
        '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', '2025-04-14',
        '2025-04-18', '2025-05-01', '2025-08-15', '2025-10-02', '2025-10-20',
        '2025-11-05', '2025-12-25',
    ],
    2026: [
        '2026-01-26', '2026-03-04', '2026-04-03', '2026-05-01',
        '2026-10-02', '2026-12-25',
    ],
};

export function buildTradingHolidayList(calendar = MARKET_TRADING_HOLIDAY_CALENDAR) {
    return Object.keys(calendar)
        .sort()
        .flatMap((year) => calendar[year]);
}

export function getMaintainedTradingHolidayYears(calendar = MARKET_TRADING_HOLIDAY_CALENDAR) {
    return Object.keys(calendar).map(Number).sort((a, b) => a - b);
}

export const DEFAULT_MARKET_SETTINGS = {
    layoutVariant: 'hybrid',
    cacheMinutes: 15,
    showIndices: true,
    showGlobalIndices: true,
    showGainers: true,
    showLosers: true,
    showSectorals: true,
    showCommodities: true,
    showCurrency: true,
    showMutualFunds: true,
    showIPO: true,
    showFIIDII: true,
    showMarketHealth: true,
    tradingHolidayYears: getMaintainedTradingHolidayYears(),
    tradingHolidays: buildTradingHolidayList(),
};
