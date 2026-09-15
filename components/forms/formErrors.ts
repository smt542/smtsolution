import type {
  FieldValues,
  Path,
  UseFormSetError,
} from "react-hook-form";

type StructuredFormError = {
  fieldErrors?: Record<string, string | string[] | undefined>;
  message?: string;
};

export function setSubmissionError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fallback: string,
) {
  const structured = error && typeof error === "object" ? error as StructuredFormError : null;
  const entries = Object.entries(structured?.fieldErrors ?? {})
    .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined);

  if (entries.length > 0) {
    entries.forEach(([field, message], index) => {
      setError(field as Path<T>, {
        type: "server",
        message: Array.isArray(message) ? message[0] : message,
      }, { shouldFocus: index === 0 });
    });
    return;
  }

  setError("root.server", {
    type: "server",
    message: error instanceof Error ? error.message : structured?.message ?? fallback,
  });
}
