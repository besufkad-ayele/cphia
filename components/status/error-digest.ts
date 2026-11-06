export function errorDigest(error: unknown) {
  if (typeof error === 'object' && error && 'digest' in error && typeof error.digest === 'string') {
    return error.digest;
  }
  return null;
}
