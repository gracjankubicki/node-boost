export function GET(context: { cache: { set: (options: { maxAge: number; tags: string[] }) => void } }) {
  context.cache.set({ maxAge: 60, tags: ["health"] });
  return Response.json({ ok: true });
}
