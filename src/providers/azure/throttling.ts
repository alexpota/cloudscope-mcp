import {
  AZURE_THROTTLE_ERROR_CODES,
  AZURE_TRANSIENT_ERROR_CODES,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_TOO_MANY_REQUESTS,
} from '../../constants.js';

/**
 * Structural shape of the Azure SDK error fields we care about.
 * Azure SDK throws `RestError` carrying `statusCode` and `code`. Node-level
 * aborts surface as `Error` with `name: 'AbortError'`.
 */
interface AzureErrorLike {
  statusCode?: number;
  code?: string;
  name?: string;
}

/**
 * True if the error represents Azure throttling. The Azure SDK's built-in
 * retry policy handles 429s WITH a `Retry-After` header before they reach
 * us — anything that gets here is a bare 429 under burst load, so we use
 * exponential backoff rather than trying to extract a server hint.
 */
export function isAzureThrottlingError(err: unknown): boolean {
  const e = err as AzureErrorLike;
  if (e?.statusCode === HTTP_STATUS_TOO_MANY_REQUESTS) return true;
  if (e?.code !== undefined && AZURE_THROTTLE_ERROR_CODES.includes(e.code)) return true;
  return false;
}

/**
 * True if the error represents a transient Azure failure that's worth one
 * more pass of our retry loop. Kept separate from throttling because the
 * semantics differ (slow down vs. hiccup-try-again). See the comment on
 * `AZURE_TRANSIENT_ERROR_CODES` for what the SDK already covers vs. what
 * this catches.
 */
export function isAzureTransientError(err: unknown): boolean {
  const e = err as AzureErrorLike;
  if (e?.statusCode === HTTP_STATUS_SERVICE_UNAVAILABLE) return true;
  if (e?.code !== undefined && AZURE_TRANSIENT_ERROR_CODES.includes(e.code)) return true;
  if (e?.name !== undefined && AZURE_TRANSIENT_ERROR_CODES.includes(e.name)) return true;
  return false;
}
