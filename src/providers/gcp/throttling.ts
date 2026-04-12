import { HTTP_STATUS_TOO_MANY_REQUESTS } from '../../constants.js';

interface GcpErrorLike {
  code?: number;
  status?: string;
}

/** Detects GCP 429 (RESOURCE_EXHAUSTED) errors for retry logic. */
export function isGcpThrottlingError(err: unknown): boolean {
  const e = err as GcpErrorLike;
  if (e?.code === HTTP_STATUS_TOO_MANY_REQUESTS) return true;
  if (e?.code === 8) return true; // gRPC RESOURCE_EXHAUSTED
  if (e?.status === 'RESOURCE_EXHAUSTED') return true;
  return false;
}
