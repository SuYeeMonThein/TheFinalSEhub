import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { findUserByEmail } from "../services/userService";

const BASIC_PREFIX = "Basic ";
const REALM = 'Basic realm="API Docs", charset="UTF-8"';
// Swagger UI loads several assets per page view; cache verified credentials
// briefly so we don't hit Supabase + bcrypt on every request.
const CACHE_TTL_MS = 5 * 60 * 1000;
const verifiedCache = new Map<string, number>();

const challenge = (res: Response) => {
  res.setHeader("WWW-Authenticate", REALM);
  res.status(401).json({ error: "Authentication required." });
};

const parseBasicAuth = (
  header: string | undefined,
): { email: string; password: string } | null => {
  if (!header || !header.startsWith(BASIC_PREFIX)) {
    return null;
  }

  const decoded = Buffer.from(
    header.slice(BASIC_PREFIX.length),
    "base64",
  ).toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator <= 0) {
    return null;
  }

  return {
    email: decoded.slice(0, separator).trim().toLowerCase(),
    password: decoded.slice(separator + 1),
  };
};

// Limit failed login attempts per IP to slow down password guessing.
export const docsLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many failed login attempts, please try again later." },
});

/**
 * Protects the Swagger docs with HTTP Basic Auth. Only users registered in
 * the Supabase `user` table (email + password) can view the docs.
 */
export const requireDocsAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const credentials = parseBasicAuth(authHeader);

  if (!credentials || !credentials.password) {
    challenge(res);
    return;
  }

  const cacheKey = createHash("sha256").update(authHeader!).digest("hex");
  const expiresAt = verifiedCache.get(cacheKey);
  if (expiresAt && expiresAt > Date.now()) {
    next();
    return;
  }
  verifiedCache.delete(cacheKey);

  try {
    const { data: user, error } = await findUserByEmail(credentials.email);

    if (error || !user?.password) {
      challenge(res);
      return;
    }

    const valid = await bcrypt.compare(credentials.password, user.password);
    if (!valid) {
      challenge(res);
      return;
    }

    verifiedCache.set(cacheKey, Date.now() + CACHE_TTL_MS);
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "Docs auth failed:",
      err instanceof Error ? err.message : "unknown error",
    );
    challenge(res);
  }
};
