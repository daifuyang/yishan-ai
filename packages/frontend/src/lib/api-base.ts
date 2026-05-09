export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ||
  ""
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  if (!path.startsWith("/")) {
    return `${API_BASE}/${path}`;
  }
  return `${API_BASE}${path}`;
}
