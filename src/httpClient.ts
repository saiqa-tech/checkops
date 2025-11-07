import { RequestError } from './errors.js';
import type { HttpRequestConfig, HttpResponse } from './types.js';

const DEFAULT_TIMEOUT = 10_000;

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const mergeSignals = (signalA?: AbortSignal, signalB?: AbortSignal): AbortSignal | undefined => {
  if (!signalA) {
    return signalB;
  }

  if (!signalB) {
    return signalA;
  }

  if (signalA.aborted) {
    return signalA;
  }

  if (signalB.aborted) {
    return signalB;
  }

  const controller = new AbortController();

  const abortWith = (source: AbortSignal) => () => controller.abort(source.reason);

  const abortFromA = abortWith(signalA);
  const abortFromB = abortWith(signalB);

  signalA.addEventListener('abort', abortFromA, { once: true });
  signalB.addEventListener('abort', abortFromB, { once: true });

  controller.signal.addEventListener(
    'abort',
    () => {
      signalA.removeEventListener('abort', abortFromA);
      signalB.removeEventListener('abort', abortFromB);
    },
    { once: true }
  );

  return controller.signal;
};

const resolveBody = (body: unknown, headers: Record<string, string>): BodyInit | undefined => {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body;
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return body;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return body;
  }

  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
    return body;
  }

  if (ArrayBuffer.isView(body)) {
    return body as BodyInit;
  }

  if (headers['content-type']) {
    return JSON.stringify(body);
  }

  headers['content-type'] = 'application/json';
  return JSON.stringify(body);
};

const getFetchImplementation = (fetchImpl?: typeof fetch): typeof fetch => {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }

  throw new RequestError('Fetch implementation is not available in the current environment.', {
    code: 'network'
  });
};

export const httpRequest = async <T = unknown>(config: HttpRequestConfig): Promise<HttpResponse<T>> => {
  const {
    url,
    method = 'GET',
    headers: providedHeaders = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    fetchImpl,
    signal
  } = config;

  const headers: Mutable<Record<string, string>> = { ...providedHeaders };
  const fetchFn = getFetchImplementation(fetchImpl);
  const controller = timeout > 0 ? new AbortController() : undefined;
  const combinedSignal = mergeSignals(signal, controller?.signal);
  const requestBody = resolveBody(body, headers);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  if (controller && timeout > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(new Error(`Request timed out after ${timeout}ms.`));
    }, timeout);
  }

  try {
    const response = await fetchFn(url, {
      method,
      headers,
      body: requestBody,
      signal: combinedSignal
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const contentType = response.headers.get('content-type') ?? '';
    let parsedBody: unknown;

    if (method === 'HEAD' || response.status === 204 || contentType.length === 0) {
      parsedBody = undefined;
    } else if (contentType.includes('application/json')) {
      parsedBody = await response.json();
    } else {
      parsedBody = await response.text();
    }

    if (!response.ok) {
      throw new RequestError('Request failed.', {
        status: response.status,
        response: parsedBody,
        headers: response.headers,
        code: 'http'
      });
    }

    return {
      status: response.status,
      data: parsedBody as T,
      headers: response.headers
    };
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (timedOut) {
      throw new RequestError('Request timed out.', {
        code: 'timeout',
        cause: error instanceof Error ? error : undefined
      });
    }

    if (error instanceof RequestError) {
      throw error;
    }

    const isAbortError = error instanceof Error && error.name === 'AbortError';

    throw new RequestError(isAbortError ? 'Request was aborted.' : 'Network request failed.', {
      code: isAbortError ? 'timeout' : 'network',
      cause: error instanceof Error ? error : undefined
    });
  }
};
