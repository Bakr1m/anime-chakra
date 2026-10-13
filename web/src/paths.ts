// Base-aware asset URLs. The app is served from the domain root locally
// but from a subpath on GitHub Pages (PAGES_BASE), so absolute /models/*
// paths 404 there. import.meta.env.BASE_URL always ends with '/'.
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\//, '')}`;
}

export function modelUrl(name: string): string {
  return withBase(`models/${name}`);
}
