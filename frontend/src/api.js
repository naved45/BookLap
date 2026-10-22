export class ApiError extends Error { constructor(m, status, details) { super(m); this.status = status; this.details = details; } }
export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null)) : '';
  let res;
  try {
    res = await fetch(`/api/v1${path}${qs}`, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError('Cannot reach the server. Check your connection and try again.', 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status, data.details);
  return data;
}
export const CONDITION_LABEL = { like_new: 'Like new', good: 'Good', fair: 'Fair', worn: 'Worn' };
export const MODE_LABEL = { swap: 'Swap', sale: 'Sale', both: 'Swap or buy' };
export const CATEGORIES = ['Fiction', 'Non Fiction', 'Self Help', 'Business', 'Technology', 'Academic', 'Other'];
