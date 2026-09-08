const PUBLIC_URL_ERROR = 'ERP_PUBLIC_URL must be an absolute HTTP(S) URL without credentials, query parameters, or fragments.';

/**
 * Derives the application mount path from the single public-URL configuration
 * source shared by the API, Vite bundle and nginx image.
 */
export function resolvePublicBasePath(publicUrl = process.env.ERP_PUBLIC_URL) {
  const value = publicUrl?.trim();
  if (!value) return '/';

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(PUBLIC_URL_ERROR);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash) {
    throw new Error(PUBLIC_URL_ERROR);
  }

  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  if (!pathname.startsWith('/') || /[\r\n;]/.test(pathname)) {
    throw new Error('ERP_PUBLIC_URL contains an unsupported application path.');
  }
  return pathname === '/' ? '/' : `${pathname}/`;
}

export function resolveViteBasePath(publicUrl = process.env.ERP_PUBLIC_URL) {
  const publicBasePath = resolvePublicBasePath(publicUrl);
  return publicBasePath === '/' ? './' : publicBasePath;
}
