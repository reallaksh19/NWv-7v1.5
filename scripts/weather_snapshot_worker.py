"""
NWv-7 Weather Snapshot Worker

Builds a fresh static-host weather snapshot from Open-Meteo for the app's
default weather cities. The browser app can then use public/data/weather_snapshot.json
without pretending old bundled data is current.
"""

from __future__ import annotations

import json
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests


OUTPUT_WEATHER = "public/data/weather_snapshot.json"
SCHEMA_VERSION = "1.0.0"
REQUEST_TIMEOUT = 20
MAX_WORKERS = 4

DEFAULT_WEATHER_CITIES = ["chennai", "trichy", "muscat", "colombo"]

WEATHER_LOCATIONS = {
    "chennai": {
        "name": "Chennai",
        "lat": 13.0827,
        "lon": 80.2707,
        "timezone": "Asia/Kolkata",
    },
    "trichy": {
        "name": "Trichy",
        "lat": 10.7905,
        "lon": 78.7047,
        "timezone": "Asia/Kolkata",
    },
    "muscat": {
        "name": "Muscat",
        "lat": 23.5880,
        "lon": 58.3829,
        "timezone": "Asia/Muscat",
    },
    "colombo": {
        "name": "Colombo",
        "lat": 6.9271,
        "lon": 79.8612,
        "timezone": "Asia/Colombo",
    },
}

WEATHER_CODES = {
    0: "Clear",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    80: "Light Rain Showers",
    81: "Rain Showers",
    82: "Violent Rain Showers",
    95: "Thunderstorm",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_now() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def epoch_ms() -> int:
    return int(utc_now().timestamp() * 1000)


def atomic_write_json(path: str, payload: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=".weather.", suffix=".json", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=True)
            handle.write("\n")
        os.replace(tmp_path, path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def as_number(value: Any) -> Optional[float]:
    try:
        parsed = float(value)
        if parsed != parsed:
            return None
        return parsed
    except Exception:
        return None


def avg(values: List[Any], digits: int = 0) -> Optional[float]:
    nums = [as_number(value) for value in values]
    nums = [value for value in nums if value is not None]
    if not nums:
        return None
    result = sum(nums) / len(nums)
    return round(result, digits)


def condition_for(code: Any) -> str:
    parsed = as_number(code)
    if parsed is None:
        return "Forecast"
    return WEATHER_CODES.get(int(round(parsed)), "Forecast")


def icon_for(code: Any) -> str:
    parsed = as_number(code)
    if parsed is None:
        return "?"
    code = int(round(parsed))
    if code <= 1:
        return "sunny"
    if code <= 3:
        return "cloudy"
    if code <= 67:
        return "rain"
    if code <= 99:
        return "storm"
    return "forecast"


def build_url(location: Dict[str, Any]) -> str:
    params = {
        "latitude": location["lat"],
        "longitude": location["lon"],
        "current": ",".join([
            "temperature_2m",
            "weather_code",
            "apparent_temperature",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
        ]),
        "hourly": ",".join([
            "temperature_2m",
            "precipitation_probability",
            "precipitation",
            "weather_code",
            "apparent_temperature",
            "relative_humidity_2m",
            "wind_speed_10m",
            "uv_index",
            "cloud_cover",
        ]),
        "daily": ",".join([
            "precipitation_probability_max",
            "precipitation_sum",
            "uv_index_max",
            "temperature_2m_max",
            "temperature_2m_min",
            "apparent_temperature_max",
            "relative_humidity_2m_mean",
            "weather_code",
            "wind_speed_10m_max",
        ]),
        "forecast_days": 7,
        "timezone": "auto",
    }

    query = "&".join(f"{key}={requests.utils.quote(str(value))}" for key, value in params.items())
    return f"https://api.open-meteo.com/v1/forecast?{query}"


def hour_label(hour: int) -> str:
    suffix = "PM" if hour >= 12 else "AM"
    hour_12 = hour % 12 or 12
    return f"{hour_12} {suffix}"


def find_current_hour_index(payload: Dict[str, Any]) -> int:
    current_time = str(payload.get("current", {}).get("time") or "")[:13]
    hourly_times = payload.get("hourly", {}).get("time") or []
    for index, value in enumerate(hourly_times):
        if str(value)[:13] == current_time:
            return index
    return 0


def build_hourly_slots(
    payload: Dict[str, Any],
    start_index: int,
    count: int = 24,
    label_now_first: bool = True,
) -> List[Dict[str, Any]]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    slots: List[Dict[str, Any]] = []

    for offset in range(count):
        index = start_index + offset
        if index >= len(times):
            break

        raw_hour = int(str(times[index])[11:13]) if len(str(times[index])) >= 13 else index % 24
        temp = as_number((hourly.get("temperature_2m") or [None])[index])
        weather_code = (hourly.get("weather_code") or [None])[index]
        precip = as_number((hourly.get("precipitation") or [None])[index]) or 0
        prob = as_number((hourly.get("precipitation_probability") or [None])[index]) or 0

        if temp is None:
            continue

        slots.append({
            "label": "Now" if label_now_first and offset == 0 else hour_label(raw_hour),
            "time": "Now" if label_now_first and offset == 0 else hour_label(raw_hour),
            "temp": round(temp),
            "icon": icon_for(weather_code),
            "iconId": icon_for(weather_code),
            "prob": round(prob),
            "precip": round(precip, 1),
            "condition": condition_for(weather_code),
        })

    return slots


def build_segment(payload: Dict[str, Any], date_key: str, start_hour: int, end_hour: int) -> Dict[str, Any]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    indices = [
        index for index, value in enumerate(times)
        if str(value).startswith(date_key) and start_hour <= int(str(value)[11:13]) <= end_hour
    ]

    temps = [(hourly.get("temperature_2m") or [None])[index] for index in indices]
    apparent = [(hourly.get("apparent_temperature") or [None])[index] for index in indices]
    precip = [as_number((hourly.get("precipitation") or [None])[index]) or 0 for index in indices]
    probs = [(hourly.get("precipitation_probability") or [None])[index] for index in indices]
    humidity = [(hourly.get("relative_humidity_2m") or [None])[index] for index in indices]
    wind = [(hourly.get("wind_speed_10m") or [None])[index] for index in indices]
    codes = [(hourly.get("weather_code") or [None])[index] for index in indices]

    code = codes[len(codes) // 2] if codes else 0
    total_rain = sum(precip)

    return {
        "temp": avg(temps),
        "feelsLike": avg(apparent),
        "icon": icon_for(code),
        "iconId": icon_for(code),
        "rainMm": "-" if total_rain < 1 else f"{total_rain:.1f}mm",
        "rainProb": {
            "avg": avg(probs) or 0,
            "min": min([as_number(v) or 0 for v in probs], default=0),
            "max": max([as_number(v) or 0 for v in probs], default=0),
            "displayString": f"~{avg(probs) or 0}%",
            "isWideRange": False,
        },
        "humidity": avg(humidity),
        "windSpeed": avg(wind),
        "hourly": build_hourly_slots(
            payload,
            indices[0],
            min(6, len(indices)),
            label_now_first=False,
        ) if indices else [],
    }


def build_weekly_forecast(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    days: List[Dict[str, Any]] = []

    for index, date_key in enumerate(dates[:7]):
        code = (daily.get("weather_code") or [0])[index]
        days.append({
            "dayLabel": "Today" if index == 0 else "Tomorrow" if index == 1 else datetime.fromisoformat(date_key).strftime("%a"),
            "label": "Today" if index == 0 else "Tomorrow" if index == 1 else datetime.fromisoformat(date_key).strftime("%a"),
            "date": date_key,
            "tempMax": avg([(daily.get("temperature_2m_max") or [None])[index]]),
            "tempMin": avg([(daily.get("temperature_2m_min") or [None])[index]]),
            "high": avg([(daily.get("temperature_2m_max") or [None])[index]]),
            "low": avg([(daily.get("temperature_2m_min") or [None])[index]]),
            "precipProb": avg([(daily.get("precipitation_probability_max") or [None])[index]]) or 0,
            "rainProb": avg([(daily.get("precipitation_probability_max") or [None])[index]]) or 0,
            "precipSum": avg([(daily.get("precipitation_sum") or [None])[index]], 1) or 0,
            "rainMm": avg([(daily.get("precipitation_sum") or [None])[index]], 1) or 0,
            "realFeelDay": avg([(daily.get("apparent_temperature_max") or [None])[index]]),
            "humidityDay": avg([(daily.get("relative_humidity_2m_mean") or [None])[index]]),
            "uvIndex": avg([(daily.get("uv_index_max") or [None])[index]]),
            "windMax": avg([(daily.get("wind_speed_10m_max") or [None])[index]]),
            "weatherCode": code,
            "icon": icon_for(code),
            "iconId": icon_for(code),
            "condition": condition_for(code),
        })

    return days


def fetch_city(city_key: str) -> Dict[str, Any]:
    location = WEATHER_LOCATIONS[city_key]
    response = requests.get(build_url(location), timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    payload = response.json()
    fetched_at = epoch_ms()

    current = payload.get("current") or {}
    current_code = current.get("weather_code")
    start_index = find_current_hour_index(payload)
    hourly24 = build_hourly_slots(payload, start_index, 24)
    weekly = build_weekly_forecast(payload)
    today_key = weekly[0]["date"] if weekly else str(current.get("time") or "")[:10]
    tomorrow_key = weekly[1]["date"] if len(weekly) > 1 else today_key

    return {
        "name": location["name"],
        "sourceMode": "snapshot",
        "sourceProvider": "open-meteo",
        "fetchedAt": fetched_at,
        "generatedAt": iso_now(),
        "timezone": payload.get("timezone") or location["timezone"],
        "current": {
            "temp": round(as_number(current.get("temperature_2m")) or 0),
            "feelsLike": round(as_number(current.get("apparent_temperature")) or as_number(current.get("temperature_2m")) or 0),
            "condition": condition_for(current_code),
            "icon": icon_for(current_code),
            "iconId": icon_for(current_code),
            "humidity": avg([current.get("relative_humidity_2m")]),
            "windSpeed": avg([current.get("wind_speed_10m")]),
            "windDirection": avg([current.get("wind_direction_10m")]),
        },
        "morning": build_segment(payload, today_key, 6, 11),
        "noon": build_segment(payload, today_key, 12, 16),
        "evening": build_segment(payload, today_key, 17, 22),
        "tomorrow": {
            "morning": build_segment(payload, tomorrow_key, 6, 11),
            "noon": build_segment(payload, tomorrow_key, 12, 16),
            "evening": build_segment(payload, tomorrow_key, 17, 22),
        },
        "hourly24": hourly24,
        "next8Hours": hourly24[:8],
        "weeklyForecast": weekly,
        "models": {
            "successful": ["open-meteo"],
            "count": 1,
            "names": "Open-Meteo",
        },
    }


def run_worker() -> None:
    generated_at = iso_now()
    fetched_at = epoch_ms()
    snapshot: Dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "fetchedAt": fetched_at,
        "sourceMode": "snapshot-worker-open-meteo",
    }

    errors: Dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(fetch_city, city): city
            for city in DEFAULT_WEATHER_CITIES
        }

        for future in as_completed(futures):
            city = futures[future]
            try:
                snapshot[city] = future.result()
            except Exception as exc:
                errors[city] = str(exc)

    loaded = [city for city in DEFAULT_WEATHER_CITIES if city in snapshot]
    if len(loaded) == 0:
        raise SystemExit(f"No weather cities fetched: {errors}")

    snapshot["sourceHealth"] = {
        "weather": {
            "status": "ok" if not errors else "partial",
            "provider": "open-meteo",
            "mode": "snapshot",
            "loadedCities": loaded,
            "failedCities": sorted(errors),
            "errors": errors,
        }
    }

    atomic_write_json(OUTPUT_WEATHER, snapshot)

    print(json.dumps({
        "status": "PASS",
        "output": OUTPUT_WEATHER,
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "fetchedAt": fetched_at,
        "loadedCities": loaded,
        "failedCities": sorted(errors),
    }, indent=2))


if __name__ == "__main__":
    run_worker()
