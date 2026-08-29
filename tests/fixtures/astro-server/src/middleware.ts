// @ts-nocheck
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.requestId = context.request.headers.get("x-request-id") ?? "fixture";
  return next();
});
