// @ts-nocheck
import type { Fetchable } from "astro";

export default {
  async fetch(request) {
    return new Response(`Advanced route: ${new URL(request.url).pathname}`);
  },
} satisfies Fetchable;
