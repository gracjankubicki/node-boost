# React Hook Form

- Match the project's existing form wrapper, resolver, field components, and error-message accessibility before adding raw `useForm` usage.
- Use the installed runtime schema resolver (Zod/Valibot/etc.) and validate again at the server boundary.
- Prefer uncontrolled registration where it fits; use `Controller` only for controlled third-party components.
- Prevent duplicate submissions, expose pending/disabled state, focus or summarize validation errors accessibly, and preserve entered values after recoverable server errors.
- Handle FormData coercion, files, async validation, and server error-to-field mapping explicitly.
