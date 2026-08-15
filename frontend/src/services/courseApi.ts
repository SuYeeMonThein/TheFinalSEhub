// note: direct access to import.meta.env allows Vite to inline the value at build time.
// using a helper function that reads `import.meta.env` at runtime prevented the
// production URL from being baked into the bundle, which caused the frontend to
// always fall back to localhost in the browser.  the build-time constant below
// ensures the correct API base is compiled in.

import { buildAuthHeaders } from "./authHeaders";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5001"
).replace(/\/$/, "");

const buildUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export interface CourseDto {
  id: string;
  courseCode: string;
  title?: string;
  semester: string;
  year: string;
  credits: number;
  instructor?: string;
  description?: string;
  advisorEmail: string;
  advisorId: number;
  advisorName: string;
}

export interface CreateCoursePayload {
  courseCode: string;
  title: string;
  description?: string;
  semester: string;
  year: string;
  credits: number;
  instructor: string;
  advisorEmail: string;
}

export type UpdateCoursePayload = CreateCoursePayload;

interface CoursesResponseBody {
  courses?: CourseDto[];
}

interface CourseResponseBody {
  course?: CourseDto;
}

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
    throw new Error(message);
  }

  return body as T;
};

export const fetchCourses = async (token: string): Promise<CourseDto[]> => {
  const response = await fetch(buildUrl("/courses"), {
    headers: buildAuthHeaders(token),
  });

  const body = await handleJsonResponse<CoursesResponseBody>(response);

  if (!body?.courses) {
    return [];
  }

  return body.courses;
};

export const createCourse = async (
  payload: CreateCoursePayload,
  token: string,
): Promise<CourseDto> => {
  const response = await fetch(buildUrl("/courses"), {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  const body = await handleJsonResponse<CourseResponseBody>(response);

  if (!body?.course) {
    throw new Error("Course payload missing in response.");
  }

  return body.course;
};

export const updateCourse = async (
  courseId: string,
  payload: UpdateCoursePayload,
  token: string,
): Promise<CourseDto> => {
  const response = await fetch(buildUrl(`/courses/${courseId}`), {
    method: "PUT",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  const body = await handleJsonResponse<CourseResponseBody>(response);

  if (!body?.course) {
    throw new Error("Course payload missing in response.");
  }

  return body.course;
};

export const deleteCourse = async (
  courseId: string,
  token: string,
): Promise<void> => {
  const response = await fetch(buildUrl(`/courses/${courseId}`), {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  await handleJsonResponse<{ message: string }>(response);
};

export const fetchCourseProjects = async (
  courseId: string,
  token: string,
): Promise<any[]> => {
  const response = await fetch(buildUrl(`/courses/${courseId}/projects`), {
    headers: buildAuthHeaders(token),
  });

  const body = await handleJsonResponse<{ projects?: any[] }>(response);

  return body?.projects || [];
};

// --- Roster APIs ---

export interface RosterEntryDto {
  id: number;
  course_id: number;
  student_id: string;
  name: string;
  email: string;
  year: string | null;
}

export interface UpsertRosterInputDto {
  studentId: string;
  name: string;
  email: string;
  year?: string;
}

export const fetchCourseRoster = async (
  courseId: string,
  token: string,
): Promise<RosterEntryDto[]> => {
  const response = await fetch(buildUrl(`/courses/${courseId}/roster`), {
    headers: buildAuthHeaders(token),
  });

  const body = await handleJsonResponse<{ roster?: RosterEntryDto[] }>(
    response,
  );
  return body?.roster || [];
};

export const upsertCourseRoster = async (
  courseId: string,
  students: UpsertRosterInputDto[],
  token: string,
): Promise<{ roster: RosterEntryDto[]; addedStudentIds: string[] }> => {
  const response = await fetch(buildUrl(`/courses/${courseId}/roster`), {
    method: "POST",
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify({ students }),
  });

  const body = await handleJsonResponse<{
    roster?: RosterEntryDto[];
    addedStudentIds?: string[];
  }>(response);
  return {
    roster: body?.roster || [],
    addedStudentIds: body?.addedStudentIds || [],
  };
};

export const deleteCourseRosterEntry = async (
  courseId: string,
  studentId: string,
  token: string,
): Promise<void> => {
  const response = await fetch(
    buildUrl(`/courses/${courseId}/roster/${encodeURIComponent(studentId)}`),
    {
      method: "DELETE",
      headers: buildAuthHeaders(token),
    },
  );
  await handleJsonResponse<{ success: boolean }>(response);
};
