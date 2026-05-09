const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:4800';
const DEFAULT_TIMEOUT = 10000;

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout}ms): ${url}`);
    }
    throw error;
  }
}

export function createBackendUrl(path: string): string {
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function backendFetch(
  path: string,
  options: FetchOptions = {}
): Promise<Response> {
  const url = createBackendUrl(path);

  try {
    const response = await fetchWithTimeout(url, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Backend error ${response.status}: ${errorText || response.statusText}`
      );
    }

    return response;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[API] ${options.method || 'GET'} ${url} failed:`, error.message);
    }
    throw error;
  }
}

export { BACKEND_URL };