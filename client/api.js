export async function request(path = '', options = {}, base = '/api/applications') {
  let response;
  try {
    const timeout = AbortSignal.timeout(15000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    response = await fetch(`${base}${path}`, {
      ...options,
      signal,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error(
      error.name === 'TimeoutError'
        ? 'The server took too long to respond. Please try again.'
        : 'Could not reach the server. Check your connection and try again.',
    );
  }
  if (response.status === 204) return null;
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
  if (!response.ok) {
    if (response.status === 401 && base === '/api/applications' && typeof window !== 'undefined')
      window.dispatchEvent(new Event('session-expired'));
    const details = body.errors?.fieldErrors;
    const error = new Error(
      details ? Object.values(details).flat().join('. ') || body.message : body.message,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}
