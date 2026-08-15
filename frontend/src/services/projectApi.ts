// build-time constant for API URL; avoids runtime lookup so the correct value
// from .env.production (or Render env) is inlined. The previous helper could not
// be replaced by Vite and therefore resulted in "localhost:5001" in production.

import { buildAuthHeaders } from "./authHeaders";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001"
).replace(/\/$/, "");

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export class ApiError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.status = status;
    this.info = info;
  }
}

export type ProjectStatus = "Draft" | "Under Review" | "Approved" | "Rejected";

export interface ProjectTeamMemberInput {
  id?: string;
  name: string;
  email: string;
  role: "student" | "lecturer";
  isPrimary: boolean;
}

export interface ProjectFileSummary {
  name: string;
  size?: string;
  type?: string;
  storagePath?: string | null;
  downloadable?: boolean;
}

export interface ProjectDto {
  id: number;
  title: string;
  type: string;
  status: ProjectStatus;
  submissionDate: string | null;
  lastModified: string | null;
  description: string;
  students: string[];
  studentDetails: Array<{ id: number; name: string; email: string }>;
  advisor: string;
  advisorEmail: string;
  teamName: string;
  keywords: string[];
  externalLinks: string[];
  files: ProjectFileSummary[];
  teamMembers: ProjectTeamMemberInput[];
  semester: string | null;
  year: string | null;
  competitionName: string | null;
  award: string | null;
  courseCode: string | null;
  completionDate: string | null;
  impact: string;
  grade?: string | null;
  rubricId?: number | null;
  feedback?: {
    advisor?: string | null;
    coordinator?: string | null;
  };
}

interface ProjectsResponseBody {
  projects?: ProjectDto[];
}

interface ProjectResponseBody {
  project?: ProjectDto;
}

export interface CreateProjectPayload {
  title: string;
  description: string;
  type: string;
  keywords: string[];
  teamName?: string;
  status: ProjectStatus;
  semester?: string;
  competitionName?: string;
  award?: string;
  externalLinks: string[];
  teamMembers: ProjectTeamMemberInput[];
  courseCode?: string;
  completionDate?: string;
  files?: ProjectFileSummary[];
}

export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  type?: string;
  keywords?: string[];
  teamName?: string;
  status?: ProjectStatus;
  semester?: string;
  competitionName?: string;
  award?: string;
  externalLinks?: string[];
  teamMembers?: ProjectTeamMemberInput[];
  courseCode?: string;
  completionDate?: string;
  files?: ProjectFileSummary[];
}

export const updateProjectGrade = async (
  projectId: number,
  grade: string,
  token: string,
): Promise<ProjectDto> => {
  const response = await fetch(buildUrl(`/projects/${projectId}/grade`), {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ grade }),
  });

  const body = await handleJsonResponse<ProjectResponseBody>(response);

  if (!body?.project) {
    throw new ApiError(
      "Project payload missing in response.",
      response.status,
      body,
    );
  }

  return body.project;
};

const handleJsonResponse = async <T>(response: Response): Promise<T> => {
  let body: unknown;

  try {
    body = await response.json();
  } catch (_error) {
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
    throw new ApiError(message, response.status, body);
  }

  return body as T;
};

export const fetchProjects = async (token: string): Promise<ProjectDto[]> => {
  const response = await fetch(buildUrl("/projects"), {
    headers: buildAuthHeaders(token),
  });

  const body = await handleJsonResponse<ProjectsResponseBody>(response);

  if (!body?.projects) {
    return [];
  }

  return body.projects;
};

export const fetchArchiveProjects = async (
  token: string,
): Promise<ProjectDto[]> => {
  const response = await fetch(buildUrl("/projects/archive"), {
    headers: buildAuthHeaders(token),
  });

  const body = await handleJsonResponse<ProjectsResponseBody>(response);

  if (!body?.projects) {
    return [];
  }

  return body.projects;
};

export const submitProject = async (
  payload: CreateProjectPayload,
  token: string,
): Promise<ProjectDto> => {
  const response = await fetch(buildUrl("/projects"), {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  const body = await handleJsonResponse<ProjectResponseBody>(response);

  if (!body?.project) {
    throw new ApiError(
      "Project payload missing in response.",
      response.status,
      body,
    );
  }

  return body.project;
};

export const updateProjectFeedback = async (
  projectId: number,
  feedback: string,
  token: string,
): Promise<ProjectDto> => {
  const response = await fetch(buildUrl(`/projects/${projectId}/feedback`), {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ feedback }),
  });

  const body = await handleJsonResponse<ProjectResponseBody>(response);

  if (!body?.project) {
    throw new ApiError(
      "Project payload missing in response.",
      response.status,
      body,
    );
  }

  return body.project;
};

export const updateProjectStatus = async (
  projectId: number,
  status: ProjectStatus,
  token: string,
): Promise<ProjectDto> => {
  const response = await fetch(buildUrl(`/projects/${projectId}/status`), {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ status }),
  });

  const body = await handleJsonResponse<ProjectResponseBody>(response);

  if (!body?.project) {
    throw new ApiError(
      "Project payload missing in response.",
      response.status,
      body,
    );
  }

  return body.project;
};

export const assignProjectRubric = async (
  projectId: number,
  rubricId: number,
  token: string,
): Promise<ProjectDto> => {
  const response = await fetch(buildUrl(`/projects/${projectId}/rubric`), {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ rubricId }),
  });

  const body = await handleJsonResponse<ProjectResponseBody>(response);

  if (!body?.project) {
    throw new ApiError(
      "Project payload missing in response.",
      response.status,
      body,
    );
  }

  return body.project;
};

export const updateProject = async (
  projectId: number,
  payload: UpdateProjectPayload,
  token: string,
): Promise<ProjectDto> => {
  const response = await fetch(buildUrl(`/projects/${projectId}`), {
    method: "PATCH",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  const body = await handleJsonResponse<ProjectResponseBody>(response);

  if (!body?.project) {
    throw new ApiError(
      "Project payload missing in response.",
      response.status,
      body,
    );
  }

  return body.project;
};

/**
 * Upload actual files for a project to Supabase Storage via the backend.
 */
export const uploadProjectFiles = async (
  projectId: number,
  files: File[],
  token: string,
): Promise<ProjectFileSummary[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(buildUrl(`/projects/${projectId}/files`), {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body && typeof body === "object" && "error" in body
        ? (body as { error: string }).error
        : "File upload failed";
    throw new ApiError(message, response.status, body);
  }

  const body = await response.json();
  return body.files ?? [];
};

/**
 * Download a project attachment file. Any authenticated user can download.
 */
export const downloadProjectFile = async (
  projectId: number,
  filename: string,
  token: string,
): Promise<void> => {
  const response = await fetch(
    buildUrl(`/projects/${projectId}/files/${encodeURIComponent(filename)}`),
    {
      headers: buildAuthHeaders(token),
    },
  );

  if (!response.ok) {
    throw new ApiError("Download failed", response.status);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
