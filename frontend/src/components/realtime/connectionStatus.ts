export function isRealtimeConnected(status) {
  const value = String(status || '').toLowerCase();
  return value === 'connected' || value === 'ready';
}
