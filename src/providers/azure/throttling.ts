import { AZURE_THROTTLE_ERROR_CODES, HTTP_STATUS_TOO_MANY_REQUESTS } from '../../constants.js';

/**
 * Structural shape of the Azure SDK error fields we care about.
 * Azure SDK throws `RestError` carrying `statusCode` and `code`.
 */
interface AzureErrorLike {
  statusCode?: number;
  code?: string;
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
