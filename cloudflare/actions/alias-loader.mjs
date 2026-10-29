const SHIM = new URL('../netlify-compat/blobs.mjs', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === '@netlify/blobs') return { url: SHIM, shortCircuit: true };
  return next(specifier, context);
}
