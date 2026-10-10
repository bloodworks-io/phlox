// Vite public/ assets referenced from code need the deploy base prefix:
// the demo is served from a GitHub Pages subpath (/phlox/), where an
// absolute "/logo.webp" escapes the app root and 404s.
const base = import.meta.env.BASE_URL ?? "/";

/** Prefix a public/ asset path (no leading slash) with the deploy base. */
export const publicAsset = (path) => `${base}${path}`;

export const LOGO_SRC = publicAsset("logo.webp");
