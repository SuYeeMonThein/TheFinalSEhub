import { NextFunction, Request, RequestHandler, Response } from "express";
import { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "../config/firebase";
import { getSupabaseAdminClient } from "../services/supabaseClient";

type AppRole = "student" | "advisor" | "coordinator";

export interface AuthedRequest extends Request {
  user?: DecodedIdToken & { role?: string };
  actingRole?: AppRole;
}

const BEARER_PREFIX = "Bearer ";
const ACTING_ROLE_HEADER = "x-acting-role";
const COORDINATOR_ROLE = "coordinator";
const ADVISOR_ROLE = "advisor";
const VALID_ROLES = new Set<AppRole>(["student", "advisor", "coordinator"]);

const parseRole = (value: unknown): AppRole | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase() as AppRole;
  return VALID_ROLES.has(normalized) ? normalized : undefined;
};

const isMissingUserRolesTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message =
    "message" in error
      ? String(error.message ?? "").toLowerCase()
      : "";

  return code === "42P01" || message.includes("user_roles");
};

const resolveEffectiveRole = async (
  decodedToken: DecodedIdToken & { role?: string },
  requestedRole: AppRole | undefined,
): Promise<{
  role: AppRole;
  status?: number;
  error?: string;
}> => {
  const tokenRole = parseRole(decodedToken.role) ?? "student";

  if (!requestedRole) {
    return { role: tokenRole };
  }

  const email = decodedToken.email;
  if (!email) {
    return {
      role: tokenRole,
      status: 400,
      error: "Email address missing from authentication token.",
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data: dbUser, error: userError } = await supabase
    .from("user")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    return {
      role: tokenRole,
      status: 500,
      error: userError.message,
    };
  }

  if (!dbUser) {
    return {
      role: tokenRole,
      status: 404,
      error: "User not found.",
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", dbUser.id)
    .eq("role", requestedRole)
    .maybeSingle();

  if (membershipError) {
    // Backward-compatible fallback before the migration is applied.
    if (
      isMissingUserRolesTableError(membershipError) &&
      parseRole(dbUser.role) === requestedRole
    ) {
      return { role: requestedRole };
    }

    return {
      role: tokenRole,
      status: 500,
      error: membershipError.message,
    };
  }

  if (!membership) {
    return {
      role: tokenRole,
      status: 403,
      error: "Requested acting role is not assigned to this user.",
    };
  }

  return { role: requestedRole };
};

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

    const actingRoleHeader = req.header(ACTING_ROLE_HEADER);
    if (actingRoleHeader && !parseRole(actingRoleHeader)) {
      res.status(400).json({ error: "Invalid X-Acting-Role header value." });
      return;
    }

    const requestedRole = parseRole(actingRoleHeader);
    const resolved = await resolveEffectiveRole(decodedToken, requestedRole);

    if (resolved.error) {
      res.status(resolved.status ?? 403).json({ error: resolved.error });
      return;
    }

    req.user = { ...decodedToken, role: resolved.role };
    req.actingRole = resolved.role;
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
  const role = parseRole(req.actingRole ?? req.user?.role);

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
  const role = parseRole(req.actingRole ?? req.user?.role);

  if (role !== ADVISOR_ROLE) {
    res
      .status(403)
      .json({ error: "Forbidden", message: "Advisor role required." });
    return;
  }

  next();
};
