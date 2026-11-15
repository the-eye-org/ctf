import type { NextRequest } from 'next/server';
import { lookupSession, SESSION_COOKIE } from '@/lib/auth/session';
import { json } from '@/lib/http';
import { saveUploadedFile, validUpload } from '@/lib/workspace/uploaded';
export const runtime = 'nodejs';
export async function PUT(req: NextRequest) {
  const session = await lookupSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session.ok || session.session.role !== 'admin')
    return json({ error: 'Unauthorized' }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const workspace = q.get('workspace') ?? '',
    key = q.get('key') ?? '';
  if (!validUpload(workspace, key, q.get('expires') ?? '', q.get('token') ?? ''))
    return json({ error: 'Invalid or expired upload' }, { status: 403 });
  if (!req.body) return json({ error: 'Missing file' }, { status: 400 });
  if (Number(req.headers.get('content-length')) > 32 * 1024 * 1024)
    return json({ error: 'Maximum upload is 32 MiB' }, { status: 413 });
  try {
    await saveUploadedFile(workspace, key, req.body);
    return json({ ok: true });
  } catch {
    return json({ error: 'Upload failed; maximum file size is 32 MiB' }, { status: 400 });
  }
}
