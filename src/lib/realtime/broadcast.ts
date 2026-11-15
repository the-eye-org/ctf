import { sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { env } from '@/lib/env';
import type { EventStatus } from '@/lib/scoring/points';

// TRD §6: public pings only. A payload is never built from request or team data, so none can leak.
export const channelName = () => `${env.REALTIME_CHANNEL_PREFIX}:public`;

export const boardPayload = (): Record<string, never> => ({});
export const statusPayload = (status: EventStatus): { status: EventStatus } => ({ status });

// Polling reads committed database state; no outbound notification is needed.
export async function sendBroadcast(
  event: 'board' | 'status',
  payload: Record<string, unknown>,
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  void event;
  void payload;
  void fetchImpl;
  return true;
}

// Call after the transaction has committed: this uses `db`, not `tx`.
// The gate lets about one ping per second through; clients refetch again 1.5 s later.
export async function notifyBoard(): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  try {
    const [row] = await db.execute<{ open: boolean }>(
      sql`SELECT app.try_open_gate('board') AS open`,
    );
    if (row?.open) await sendBroadcast('board', boardPayload());
  } catch (e) {
    console.error('broadcast failed', {
      event: 'board',
      message: e instanceof Error ? e.message : 'error',
    });
  }
}

export async function notifyStatus(status: EventStatus): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  await sendBroadcast('status', statusPayload(status));
}
