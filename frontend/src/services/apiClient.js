/**
 * Standardized API Client
 * Wraps native fetch with timeout cancellation, custom headers, and structured error handling.
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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

      clearTimeout(timer);

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
          (payload && payload.error) ||
          `Request failed with status ${response.status}: ${response.statusText}`;

        const error = new Error(errorMsg);
        error.status = response.status;
        error.code = (payload && payload.error && payload.error.code) || 'API_ERROR';
        error.payload = payload;
        throw error;
      }

      return payload;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
        timeoutError.code = 'TIMEOUT_ERROR';
        throw timeoutError;
      }
      throw err;
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
