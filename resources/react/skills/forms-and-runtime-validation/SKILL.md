---
name: forms-and-runtime-validation
description: Build forms with the installed form and runtime-schema libraries, accessible errors, and server revalidation.
---

# Forms and Runtime Validation

## When to use this skill

Use when adding or changing form fields, schemas, submit flows, files, or server validation.

## Procedure

1. Identify the existing form abstraction and schema library (RHF/custom; Zod/Valibot). Extend them rather than adding a second stack.
2. Define coercion/transforms and client resolver behavior, then validate the untrusted payload again at the server boundary.
3. Map server errors to fields/form status without leaking internals; preserve values after recoverable errors and prevent duplicate submissions.
4. Make labels, descriptions, error association, focus management, pending state, and disabled behavior accessible.
5. Handle async phone/file validation, FormData, uploads, and cancellation according to nearby code.
