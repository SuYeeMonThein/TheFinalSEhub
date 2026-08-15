import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

const isBodyParserError = (err: unknown): err is SyntaxError & { body?: unknown } =>
  err instanceof SyntaxError && "body" in err;

const isMulterError = (err: unknown): err is Error =>
  err instanceof Error && err.name === "MulterError";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed.",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (isMulterError(err)) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (isBodyParserError(err)) {
    res.status(400).json({ error: "Invalid JSON payload." });
    return;
  }

  const httpError = err as HttpError | null;
  const status = httpError?.statusCode ?? httpError?.status ?? 500;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(
      "Unhandled error:",
      err instanceof Error ? err.message : "Unknown error",
    );
  }

  res.status(status).json({ error: status >= 500 ? "Internal server error." : "Request failed." });
};
