// Browser navigation does not receive Next.js basePath automatically.
export function appPath(path: string): string {
  if (path === '/ctf' || path.startsWith('/ctf/')) return path;
  return `/ctf${path.startsWith('/') ? path : `/${path}`}`;
}
