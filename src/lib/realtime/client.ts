// Live state uses same-origin polling; no external socket service is required.
export type LiveEvent = 'board' | 'status';
export function subscribeLive(
  _channel: string,
  _onEvent: (event: LiveEvent) => void,
  onConn: (up: boolean) => void,
): () => void {
  void _channel;
  void _onEvent;
  onConn(false);
  return () => {};
}
