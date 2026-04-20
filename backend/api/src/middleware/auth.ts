import { NextFunction, Request, RequestHandler, Response } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "../config/firebase";

export interface AuthedRequest extends Request {
  user?: DecodedIdToken & { role?: string };
}

const BEARER_PREFIX = "Bearer ";
const COORDINATOR_ROLE = "coordinator";
const ADVISOR_ROLE = "advisor";

export const verifyFirebaseAuth: RequestHandler = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization as string | undefined;

  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: "Missing or invalid Authorization header." });
    return;
  }

  try {
    const idToken = authHeader.slice(BEARER_PREFIX.length);
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    // Log only a short message — never leak token details or stack traces
    // eslint-disable-next-line no-console
    console.error(
      "Firebase auth verification failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const requireCoordinator: RequestHandler = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  const role = req.user?.role;

  if (role !== COORDINATOR_ROLE) {
    res
      .status(403)
      .json({ error: "Forbidden", message: "Coordinator role required." });
    return;
  }

  next();
};

export const requireAdvisor: RequestHandler = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  const role = req.user?.role;

  if (role !== ADVISOR_ROLE) {
    res
      .status(403)
      .json({ error: "Forbidden", message: "Advisor role required." });
    return;
  }

  next();
};
