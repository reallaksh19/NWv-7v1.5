export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function withTimeout(promise, timeoutMs = 12000, options = {}) {
  const message = options.message || `Operation timed out after ${timeoutMs}ms`;

  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new TimeoutError(message);
      reject(error);
      options.abortController?.abort(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 12000, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const relayAbort = () => controller.abort(signal.reason);

  if (signal?.aborted) {
    controller.abort(signal.reason);
  } else if (signal) {
    signal.addEventListener('abort', relayAbort, { once: true });
  }

  try {
    return await withTimeout(fetch(url, { ...fetchOptions, signal: controller.signal }), timeoutMs, {
      message: `Fetch timed out after ${timeoutMs}ms: ${url}`,
      abortController: controller,
    });
  } finally {
    signal?.removeEventListener?.('abort', relayAbort);
  }
}
