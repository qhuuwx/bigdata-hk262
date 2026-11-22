/**
 * Standardized API Client
 * Wraps native fetch with timeout cancellation, external AbortSignal composition,
 * custom headers, and structured error handling.
 */

import { getApiBaseUrl } from '../config/apiConfig';

class ApiClient {
  constructor() {
    this.defaultTimeoutMs = 10000;
  }

  /**
   * Internal request dispatcher
   */
  async request(endpoint, options = {}) {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const externalSignal = options.signal;

    const controller = new AbortController();
    let isTimedOut = false;

    const timer = setTimeout(() => {
      isTimedOut = true;
      controller.abort();
    }, timeoutMs);

    const onExternalAbort = () => {
      controller.abort();
    };

    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        const abortErr = new Error(`Request canceled: ${endpoint}`);
        abortErr.name = 'AbortError';
        abortErr.isCanceled = true;
        throw abortErr;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    const headers = {
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      let payload = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        const text = await response.text();
        payload = text ? { raw: text } : null;
      }

      if (!response.ok) {
        const errorMsg = (payload && payload.error && payload.error.message) ||
          (payload && typeof payload.error === 'string' && payload.error) ||
          `Request failed with status ${response.status}: ${response.statusText}`;

        const error = new Error(errorMsg);
        error.status = response.status;
        error.code = (payload && payload.error && payload.error.code) || 'API_ERROR';
        error.payload = payload;
        throw error;
      }

      return payload;
    } catch (err) {
      if (err.name === 'AbortError') {
        if (isTimedOut) {
          const timeoutError = new Error(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
          timeoutError.code = 'TIMEOUT_ERROR';
          throw timeoutError;
        }
        const cancelError = new Error(`Request canceled: ${endpoint}`);
        cancelError.name = 'AbortError';
        cancelError.isCanceled = true;
        throw cancelError;
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body = {}, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
