import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 * On failure it returns a 400 with structured error details.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (result.success) {
      req.body = result.data;
      next();
      return;
    }

    res.status(400).json({
      error: "Validation failed.",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  };
