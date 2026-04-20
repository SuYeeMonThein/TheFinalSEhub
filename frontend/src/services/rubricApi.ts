// inline build-time API URL constant
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001"
).replace(/\/$/, "");

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// ── Types ────────────────────────────────────────────────────────────────

export interface RubricLevelDto {
  id: number;
  criterion_id: number;
  name: string;
  description: string | null;
  points: number;
  sort_order: number;
}

export interface RubricCriterionDto {
  id: number;
  rubric_id: number;
  name: string;
  description: string | null;
  plo_ids: string[];
  weight: number;
  sort_order: number;
  levels: RubricLevelDto[];
}

export interface RubricDto {
  id: number;
  name: string;
  description: string | null;
  project_types: string[];
  max_points: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  criteria: RubricCriterionDto[];
}

export interface LevelInput {
  name: string;
  description?: string;
  points: number;
}

export interface CriterionInput {
  name: string;
  description?: string;
  ploIds: string[];
  weight: number;
  levels: LevelInput[];
}

export interface CreateRubricPayload {
  name: string;
  description?: string;
  projectTypes: string[];
  criteria: CriterionInput[];
  maxPoints?: number;
}

export interface UpdateRubricPayload {
  name?: string;
  description?: string;
  projectTypes?: string[];
  criteria?: CriterionInput[];
  maxPoints?: number;
  isActive?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const handleJsonResponse = async <T>(response: Response): Promise<T> => {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: string }).error === "string"
        ? (body as { error: string }).error
        : "Request failed";
    throw new Error(message);
  }

  return body as T;
};

// ── API Functions ────────────────────────────────────────────────────────

export const fetchRubrics = async (token: string): Promise<RubricDto[]> => {
  const response = await fetch(buildUrl("/rubrics"), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await handleJsonResponse<{ rubrics?: RubricDto[] }>(response);
  return body?.rubrics ?? [];
};

export const fetchRubricById = async (
  id: number,
  token: string,
): Promise<RubricDto> => {
  const response = await fetch(buildUrl(`/rubrics/${id}`), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await handleJsonResponse<{ rubric?: RubricDto }>(response);
  if (!body?.rubric) throw new Error("Rubric not found.");
  return body.rubric;
};

export const createRubric = async (
  payload: CreateRubricPayload,
  token: string,
): Promise<RubricDto> => {
  const response = await fetch(buildUrl("/rubrics"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await handleJsonResponse<{ rubric?: RubricDto }>(response);
  if (!body?.rubric) throw new Error("Rubric payload missing in response.");
  return body.rubric;
};

export const updateRubric = async (
  id: number,
  payload: UpdateRubricPayload,
  token: string,
): Promise<RubricDto> => {
  const response = await fetch(buildUrl(`/rubrics/${id}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await handleJsonResponse<{ rubric?: RubricDto }>(response);
  if (!body?.rubric) throw new Error("Rubric payload missing in response.");
  return body.rubric;
};

export const toggleRubricStatus = async (
  id: number,
  token: string,
): Promise<RubricDto> => {
  const response = await fetch(buildUrl(`/rubrics/${id}/toggle`), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await handleJsonResponse<{ rubric?: RubricDto }>(response);
  if (!body?.rubric) throw new Error("Rubric payload missing in response.");
  return body.rubric;
};

export const deleteRubric = async (
  id: number,
  token: string,
): Promise<void> => {
  const response = await fetch(buildUrl(`/rubrics/${id}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  await handleJsonResponse<{ message: string }>(response);
};
