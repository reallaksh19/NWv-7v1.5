import {
  makeEnvelope,
  ENVELOPE_SOURCES,
  ENVELOPE_FRESHNESS,
} from './dataEnvelope.js';
import { withTimeout } from '../utils/withTimeout.js';

function makeAbortableSignal(externalSignal) {
  const controller = new AbortController();
  const relayAbort = () => controller.abort(externalSignal.reason);

  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', relayAbort, { once: true });
  }

  return {
    controller,
    signal: controller.signal,
    cleanup: () => externalSignal?.removeEventListener?.('abort', relayAbort),
  };
}

export function publicDataUrl(path) {
  const base = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/');
  return `${base}${String(path).replace(/^\//, '')}`;
}

function numericTimestamp(value) {
  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  const parsed = Date.parse(value);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

export async function fetchJson(url, options = {}) {
  const {
    datasetId = `fetch:${url}`,
    timeoutMs = 12000,
    cache = 'no-cache',
    headers = {},
    source = ENVELOPE_SOURCES.LIVE,
    signal,
  } = options;

  const startedAt = Date.now();
  const abortable = makeAbortableSignal(signal);

  try {
    const response = await withTimeout(
      fetch(url, {
        cache,
        signal: abortable.signal,
        headers: {
          Accept: 'application/json',
          ...headers,
        },
      }),
      timeoutMs,
      {
        message: `Fetch timed out after ${timeoutMs}ms: ${url}`,
        abortController: abortable.controller,
      }
    );

    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      return makeEnvelope({
        ok: false,
        datasetId,
        data: null,
        source: ENVELOPE_SOURCES.FAILED,
        freshness: ENVELOPE_FRESHNESS.UNKNOWN,
        error: `HTTP ${response.status}`,
        diagnostics: [
          {
            event: 'fetch_json_http_error',
            severity: 'error',
            message: `HTTP ${response.status} while fetching ${url}`,
            ms: durationMs,
          },
        ],
        validation: {
          passed: false,
          errors: [`HTTP ${response.status}`],
          warnings: [],
        },
      });
    }

    const data = await response.json();

    const generatedAt =
      numericTimestamp(data?.generatedAt) ||
      numericTimestamp(data?.generated_at) ||
      numericTimestamp(data?.fetchedAt) ||
      numericTimestamp(data?.timestamp) ||
      Date.now();

    return makeEnvelope({
      ok: true,
      datasetId,
      data,
      source,
      freshness: ENVELOPE_FRESHNESS.FRESH,
      fetchedAt: Date.now(),
      generatedAt,
      diagnostics: [
        {
          event: 'fetch_json_success',
          severity: 'info',
          message: `Fetched ${url}`,
          ms: durationMs,
        },
      ],
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const timeoutError =
      abortable.signal.reason?.name === 'TimeoutError'
        ? abortable.signal.reason
        : null;
    const reportedError = timeoutError || error;
    const message = reportedError?.message || String(reportedError);

    return makeEnvelope({
      ok: false,
      datasetId,
      data: null,
      source: ENVELOPE_SOURCES.FAILED,
      freshness: ENVELOPE_FRESHNESS.UNKNOWN,
      error: reportedError?.name === 'TimeoutError' ? 'TimeoutError' : message,
      diagnostics: [
        {
          event: 'fetch_json_failed',
          severity: 'error',
          message,
          ms: durationMs,
        },
      ],
      validation: {
        passed: false,
        errors: [message],
        warnings: [],
      },
    });
  } finally {
    abortable.cleanup();
  }
}
