# Weather/Main/Following/Buzz/Insight Closeout Report

Status: **FAIL**
Generated: `2026-05-20T14:05:46.490Z`

## Static checks

- ✅ **package script: test:weather-main-following-buzz-insight-closeout** — test:weather-main-following-buzz-insight-closeout is present in package.json
- ✅ **manifest command: weather-main-following-buzz-insight-closeout** — weather-main-following-buzz-insight-closeout is present in certification_manifest.json
- ✅ **On This Day policy exists** — On This Day default OFF policy is present
- ✅ **MainPage strips On This Day at source** — MainPage strips On This Day before topline and avoids boolean/function naming bug
- ✅ **Topline supports includeOnThisDay** — generateTopline can disable On This Day safely
- ✅ **Colombo in weather registry** — Colombo and configured city helper exist
- ✅ **DetailedWeatherCard uses configured cities** — Weather vertical tabs use central configured cities
- ✅ **WeatherLocationManager refreshes after city changes** — Weather manager can force refresh after add/delete
- ✅ **Following Sri Lanka edition inference** — Following tab can infer Sri Lanka as LK/en
- ✅ **HTML sanitizer exists** — Shared HTML text sanitizer exists
- ✅ **Buzz and Up Ahead sanitize feed text** — ImageCard, NewsSection, and UpAhead sanitize HTML-like feed text

## Optional runtime checks

- ❌ **Insight real snapshot ratchetGate exists** — real_insight_quality_report.json exists but ratchetGate is missing
- ✅ **Insight real snapshot strict status** — Strict status is UNKNOWN

## Command runs

- ✅ `npm run test:weather-closeout-regression-static` — exit 0
- ✅ `npm run test:weather-main-following-buzz-insight-closeout` — exit 0

## Next action

- Fix the failed/warned items above before running full certification.
