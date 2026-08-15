// inline API base url at build time to avoid runtime fallback to localhost
import { buildAuthHeaders } from "./authHeaders";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001"
).replace(/\/$/, "");

type ApiErrorResponse = { error?: string };

export type CreateUserRole = "student" | "advisor" | "coordinator";

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: CreateUserRole;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: CreateUserRole;
}

interface CreateUserResponse {
  user: ApiUser;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: CreateUserRole;
}

export interface UserRolesResponse {
  roles: CreateUserRole[];
}

export interface UpdateUserRolesResponse {
  userId: number;
  roles: CreateUserRole[];
  primaryRole: CreateUserRole;
}

interface UpdateUserResponse {
  user?: ApiUser | null;
}

export class ApiError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const createUser = async (
  payload: CreateUserRequest,
  token: string,
): Promise<ApiUser> => {
  const response = await fetch(buildUrl("/users"), {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  let body: CreateUserResponse | ApiErrorResponse | undefined;
  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to create user.";
    throw new ApiError(message, response.status, body);
  }

  if (!body || !("user" in body)) {
    throw new ApiError(
      "User payload missing in response.",
      response.status,
      body,
    );
  }

  return (body as CreateUserResponse).user;
};

interface ListUsersResponse {
  users?: ApiUser[] | null;
  user?: ApiUser | null;
}

export const listUsers = async (token: string): Promise<ApiUser[]> => {
  const response = await fetch(buildUrl("/users"), {
    headers: buildAuthHeaders(token),
  });

  let body: ListUsersResponse | ApiErrorResponse | undefined;

  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to fetch users.";
    throw new ApiError(message, response.status, body);
  }

  if (!body) {
    return [];
  }

  if ("users" in body && Array.isArray(body.users)) {
    return body.users;
  }

  if ("user" in body && body.user) {
    return [body.user];
  }

  return [];
};

export const updateUser = async (
  id: number,
  payload: UpdateUserRequest,
  token: string,
): Promise<ApiUser> => {
  const sanitizedPayload: Record<string, string> = {};

  if (typeof payload.name === "string" && payload.name.trim().length > 0) {
    sanitizedPayload.name = payload.name.trim();
  }

  if (typeof payload.email === "string" && payload.email.trim().length > 0) {
    sanitizedPayload.email = payload.email.trim();
  }

  if (typeof payload.role === "string" && payload.role.trim().length > 0) {
    sanitizedPayload.role = payload.role.trim();
  }

  if (
    typeof payload.password === "string" &&
    payload.password.trim().length > 0
  ) {
    sanitizedPayload.password = payload.password.trim();
  }

  if (Object.keys(sanitizedPayload).length === 0) {
    throw new ApiError("No updates supplied.", 400, payload);
  }

  const response = await fetch(buildUrl(`/users/${id}`), {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(sanitizedPayload),
  });

  let body: UpdateUserResponse | ApiErrorResponse | undefined;

  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to update user.";
    throw new ApiError(message, response.status, body ?? payload);
  }

  if (!body || !("user" in body) || !body.user) {
    throw new ApiError(
      "User payload missing in response.",
      response.status,
      body,
    );
  }

  return body.user;
};

export const deleteUser = async (id: number, token: string): Promise<void> => {
  const response = await fetch(buildUrl(`/users/${id}`), {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    let body: ApiErrorResponse | undefined;

    try {
      body = (await response.json()) as typeof body;
    } catch (_error) {
      body = undefined;
    }

    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to delete user.";
    throw new ApiError(message, response.status, body);
  }
};

interface AssignStudentCoursesResponse {
  success?: boolean;
  assignedCourseIds?: number[];
}

export const assignStudentToCourses = async (
  userId: number,
  courseIds: number[],
  token: string,
): Promise<number[]> => {
  const normalizedCourseIds = Array.from(
    new Set(
      courseIds.filter(
        (courseId) => Number.isInteger(courseId) && courseId > 0,
      ),
    ),
  );

  if (normalizedCourseIds.length === 0) {
    throw new ApiError("Please select at least one course.", 400, {
      courseIds,
    });
  }

  const response = await fetch(
    buildUrl(`/users/${userId}/course-assignments`),
    {
      method: "POST",
      headers: buildAuthHeaders(token, true),
      body: JSON.stringify({ courseIds: normalizedCourseIds }),
    },
  );

  let body: AssignStudentCoursesResponse | ApiErrorResponse | undefined;

  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to assign student to courses.";
    throw new ApiError(message, response.status, body);
  }

  return Array.isArray(
    (body as AssignStudentCoursesResponse)?.assignedCourseIds,
  )
    ? ((body as AssignStudentCoursesResponse).assignedCourseIds ?? [])
    : [];
};

export const getUserRoles = async (
  id: number,
  token: string,
): Promise<UserRolesResponse> => {
  const response = await fetch(buildUrl(`/users/${id}/roles`), {
    headers: buildAuthHeaders(token),
  });

  let body: UserRolesResponse | ApiErrorResponse | undefined;

  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to load user roles.";
    throw new ApiError(message, response.status, body);
  }

  if (!body || !("roles" in body) || !Array.isArray(body.roles)) {
    throw new ApiError("Roles payload missing in response.", response.status, body);
  }

  return {
    roles: body.roles,
  };
};

export const getMyRoles = async (token: string): Promise<UserRolesResponse> => {
  const response = await fetch(buildUrl(`/users/me/roles`), {
    headers: buildAuthHeaders(token),
  });

  let body: UserRolesResponse | ApiErrorResponse | undefined;

  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to load your roles.";
    throw new ApiError(message, response.status, body);
  }

  if (!body || !("roles" in body) || !Array.isArray(body.roles)) {
    throw new ApiError("Roles payload missing in response.", response.status, body);
  }

  return {
    roles: body.roles,
  };
};

export const updateUserRoles = async (
  id: number,
  roles: CreateUserRole[],
  token: string,
): Promise<UpdateUserRolesResponse> => {
  const normalizedRoles = Array.from(
    new Set(
      roles.filter(
        (role) =>
          role === "student" || role === "advisor" || role === "coordinator",
      ),
    ),
  );

  if (normalizedRoles.length === 0) {
    throw new ApiError("At least one role is required.", 400, { roles });
  }

  const response = await fetch(buildUrl(`/users/${id}/roles`), {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ roles: normalizedRoles }),
  });

  let body: UpdateUserRolesResponse | ApiErrorResponse | undefined;

  try {
    body = (await response.json()) as typeof body;
  } catch (_error) {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body && "error" in body && typeof body.error === "string"
        ? body.error
        : "Failed to update user roles.";
    throw new ApiError(message, response.status, body);
  }

  if (
    !body ||
    !("userId" in body) ||
    typeof body.userId !== "number" ||
    !("roles" in body) ||
    !Array.isArray(body.roles) ||
    !("primaryRole" in body) ||
    typeof body.primaryRole !== "string"
  ) {
    throw new ApiError("Updated roles payload missing in response.", response.status, body);
  }

  return body;
};
