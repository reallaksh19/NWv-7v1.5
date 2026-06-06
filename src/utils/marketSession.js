const MARKET_TIME_ZONE = 'Asia/Kolkata';
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

function getIstParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: MARKET_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);

    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        weekday: map.weekday,
        hour: Number(map.hour),
        minute: Number(map.minute)
    };
}

function buildIstDateKey(parts) {
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function normalizeHolidayList(tradingHolidays = []) {
    const holidays = tradingHolidays
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    return {
        holidaySet: new Set(holidays),
        holidayYears: new Set(
            holidays
                .map((value) => Number(value.slice(0, 4)))
                .filter(Number.isFinite)
        ),
    };
}

export function getMarketSessionState({
    now = new Date(),
    lastUpdated = null,
    tradingHolidays = []
} = {}) {
    const parts = getIstParts(now);
    const currentMinutes = parts.hour * 60 + parts.minute;
    const isWeekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';
    const { holidaySet, holidayYears } = normalizeHolidayList(tradingHolidays);
    const todayKey = buildIstDateKey(parts);
    const hasHolidayCalendarForYear = holidayYears.has(parts.year);
    const isHoliday = hasHolidayCalendarForYear && holidaySet.has(todayKey);

    const ageMs = lastUpdated ? Math.max(0, now.getTime() - lastUpdated) : Infinity;
    const ageMinutes = Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null;

    const ageLabel = ageMinutes === null
        ? '--'
        : ageMinutes < 60
            ? `${ageMinutes}m ago`
            : `${Math.round(ageMinutes / 60)}h ago`;
    const holidayCalendarStatus = hasHolidayCalendarForYear
        ? 'known_year'
        : 'unknown_year_weekday_rules';
    const baseState = {
        ageLabel,
        ageMinutes,
        holidayCalendarStatus,
        holidayCalendarYear: parts.year,
    };

    if (isWeekend || isHoliday) {
        return {
            ...baseState,
            label: 'Closed',
            tone: 'muted',
            reason: isWeekend ? 'Weekend' : 'Holiday',
            isOpen: false,
        };
    }

    if (currentMinutes < MARKET_OPEN_MINUTES || currentMinutes > MARKET_CLOSE_MINUTES) {
        return {
            ...baseState,
            label: 'After Hours',
            tone: 'warning',
            reason: 'Outside NSE session',
            isOpen: false,
        };
    }

    if (!Number.isFinite(ageMs)) {
        return {
            ...baseState,
            label: 'Delayed',
            tone: 'warning',
            reason: 'No freshness timestamp',
            isOpen: true,
        };
    }

    if (ageMs <= 15 * 60 * 1000) {
        return {
            ...baseState,
            label: 'Live',
            tone: 'success',
            reason: 'Fresh market feed',
            isOpen: true,
        };
    }

    if (ageMs <= 4 * 60 * 60 * 1000) {
        return {
            ...baseState,
            label: 'Delayed',
            tone: 'warning',
            reason: 'Older than 15 minutes',
            isOpen: true,
        };
    }

    return {
        ...baseState,
        label: 'Expired',
        tone: 'danger',
        reason: 'Older than 4 hours',
        isOpen: true,
    };
}
