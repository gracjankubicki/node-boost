export const htmlParserPackageNames = [
  "html-react-parser",
  "react-html-parser",
] as const;

export const objectSanitizerPackageNames = [
  "dompurify",
  "isomorphic-dompurify",
] as const;

export const callableSanitizerPackageNames = [
  "sanitize-html",
  "xss",
] as const;

export const richTextPackageNames = [
  ...htmlParserPackageNames,
  ...objectSanitizerPackageNames,
  ...callableSanitizerPackageNames,
] as const;

export const trackedPackageNames = [
  "next",
  "react",
  "vite",
  "react-router",
  "react-router-dom",
  "typescript",
  "tailwindcss",
  "zod",
  "valibot",
  "@tanstack/react-query",
  "react-query-kit",
  "swr",
  "zustand",
  "nuqs",
  "react-hook-form",
  "msw",
  "storybook",
  "@storybook/react",
  "@mantine/core",
  "i18next",
  "react-i18next",
  "@lingui/core",
  ...richTextPackageNames,
  "orval",
  "openapi-typescript",
  "babel-plugin-react-compiler",
  "vitest",
  "jest",
  "playwright",
  "eslint",
  "prettier",
  "@biomejs/biome",
] as const;
