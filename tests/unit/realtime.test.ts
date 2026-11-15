// R8: broadcast payloads and failure handling. No network: fetch is injected.
import { describe, expect, it, vi } from 'vitest';

import { boardPayload, channelName, sendBroadcast, statusPayload } from '@/lib/realtime/broadcast';
import { env } from '@/lib/env';

describe('broadcast payloads', () => {
  it('carry only the allowed keys', () => {
    expect(Object.keys(boardPayload())).toEqual([]);
    expect(statusPayload('running')).toEqual({ status: 'running' });
  });

  it('uses the public channel from the prefix', () => {
    expect(channelName()).toBe(`${env.REALTIME_CHANNEL_PREFIX}:public`);
  });
});

describe('polling notifications', () => {
  it('does not contact an external service', async () => {
    const fetchMock = vi.fn();
    expect(await sendBroadcast('board', {}, fetchMock)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
