import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { env } from '@/lib/env';
import {
  WORKSPACES,
  type Workspace,
  type WorkspaceFile,
  type WorkspaceFileKind,
} from '@/lib/workspace/definitions';

// Uploaded files live in a persistent private directory and are served through authenticated routes.

export const WORKSPACE_NAME = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

const TEXT = 'text/plain; charset=utf-8';
const TYPES: Record<string, { kind: WorkspaceFileKind; contentType: string }> = {
  pdf: { kind: 'pdf', contentType: 'application/pdf' },
  csv: { kind: 'csv', contentType: TEXT },
  json: { kind: 'json', contentType: TEXT },
  txt: { kind: 'text', contentType: TEXT },
  log: { kind: 'text', contentType: TEXT },
  md: { kind: 'text', contentType: TEXT },
  png: { kind: 'image', contentType: 'image/png' },
  gif: { kind: 'image', contentType: 'image/gif' },
  webp: { kind: 'image', contentType: 'image/webp' },
  jpg: { kind: 'exif', contentType: 'image/jpeg' },
  jpeg: { kind: 'exif', contentType: 'image/jpeg' },
  db: { kind: 'sqlite', contentType: 'application/octet-stream' },
  sqlite: { kind: 'sqlite', contentType: 'application/octet-stream' },
  pcap: { kind: 'pcap', contentType: 'application/octet-stream' },
  pcapng: { kind: 'pcap', contentType: 'application/octet-stream' },
};
export const UPLOAD_EXTENSIONS = Object.keys(TYPES);

export function fileType(key: string) {
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return FILE_NAME.test(key) && Object.hasOwn(TYPES, ext) ? TYPES[ext] : undefined;
}

const ROOT = resolve(process.env.WORKSPACE_STORAGE_DIR ?? './data/workspaces');
function filePath(workspace: string, key: string) {
  if (!WORKSPACE_NAME.test(workspace) || !fileType(key)) throw new Error('Invalid workspace file');
  return join(ROOT, workspace, key);
}
export async function listUploadedWorkspaces(): Promise<string[]> {
  await mkdir(ROOT, { recursive: true });
  return (await readdir(ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && WORKSPACE_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}
export async function listUploadedFiles(workspace: string): Promise<WorkspaceFile[]> {
  if (!WORKSPACE_NAME.test(workspace)) return [];
  try {
    return (await readdir(join(ROOT, workspace), { withFileTypes: true }))
      .flatMap((entry) => {
        const type = fileType(entry.name);
        return entry.isFile() && type ? [{ key: entry.name, ...type }] : [];
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

// Built-in workspaces win; anything else is looked up in the bucket.
export async function resolveWorkspace(name: string): Promise<Workspace | undefined> {
  if (Object.hasOwn(WORKSPACES, name)) return WORKSPACES[name];
  const files = await listUploadedFiles(name);
  return files.length > 0 ? { title: name, intro: '', files } : undefined;
}

export async function findFile(workspace: string, key: string) {
  return (await resolveWorkspace(workspace))?.files.find((file) => file.key === key);
}

export async function downloadUploadedFile(workspace: string, key: string): Promise<Buffer> {
  return readFile(filePath(workspace, key));
}
function signature(workspace: string, key: string, expires: string) {
  return createHmac('sha256', env.CSRF_SECRET)
    .update(JSON.stringify([workspace, key, expires]))
    .digest('hex');
}
export async function signUpload(workspace: string, key: string): Promise<string> {
  filePath(workspace, key);
  const expires = String(Date.now() + 5 * 60_000);
  return `/ctf/api/admin/workspaces/upload?${new URLSearchParams({ workspace, key, expires, token: signature(workspace, key, expires) })}`;
}
export function validUpload(
  workspace: string,
  key: string,
  expires: string,
  token: string,
): boolean {
  if (
    !WORKSPACE_NAME.test(workspace) ||
    !fileType(key) ||
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now()
  )
    return false;
  const expected = Buffer.from(signature(workspace, key, expires));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
export async function saveUploadedFile(
  workspace: string,
  key: string,
  body: ReadableStream<Uint8Array>,
) {
  const destination = filePath(workspace, key);
  await mkdir(join(ROOT, workspace), { recursive: true });
  const temporary = join(ROOT, workspace, `.${randomUUID()}.tmp`);
  let bytes = 0;
  const limit = new Transform({
    transform(chunk, encoding, callback) {
      bytes += chunk.length;
      callback(bytes > 32 * 1024 * 1024 ? new Error('Upload exceeds 32 MiB') : null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(body as import('node:stream/web').ReadableStream),
      limit,
      createWriteStream(temporary, { flags: 'wx' }),
    );
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
export async function removeUploadedFile(workspace: string, key: string) {
  await rm(filePath(workspace, key), { force: true });
}
