// @ts-nocheck
import { defineAction } from "astro:actions";
import { z } from "astro/zod";

export const server = {
  savePreference: defineAction({
    input: z.object({
      locale: z.string(),
    }),
    handler: async ({ locale }) => ({ locale }),
  }),
};
