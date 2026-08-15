export type ActingRole = "student" | "advisor" | "coordinator";

const parseActingRole = (value: unknown): ActingRole | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "student" ||
    normalized === "advisor" ||
    normalized === "coordinator"
  ) {
    return normalized;
  }

  return undefined;
};

const getStoredActingRole = (): ActingRole | undefined => {
  // Keep compatibility with existing mock role storage key.
  const role =
    parseActingRole(localStorage.getItem("actingRole")) ??
    parseActingRole(localStorage.getItem("mockRoleOverride"));

  return role;
};

export const buildAuthHeaders = (
  token: string,
  includeJsonContentType = false,
): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }

  const actingRole = getStoredActingRole();
  if (actingRole) {
    headers["X-Acting-Role"] = actingRole;
  }

  return headers;
};
