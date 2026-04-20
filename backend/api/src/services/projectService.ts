import {
  PostgrestError,
  PostgrestResponse,
  PostgrestSingleResponse,
} from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabaseClient";
import { UserRecord } from "./userService";

export type ProjectType = "academic" | "competition" | "service" | "other";
export type ProjectStatus = "draft" | "underreview" | "approved" | "reject";

export interface ProjectRecord {
  id: number;
  name: string;
  keyword: string;
  team_name: string | null;
  start_date: string | null;
  end_date: string | null;
  feedback_advisor: string | null;
  feedback_coordinator: string | null;
  comment_student: string | null;
  comment_advisor: string | null;
  project_type: ProjectType;
  description: string | null;
  competition_name: string | null;
  semester: "1" | "2";
  year: number;
  advisor_id: number | null;
  course_id: number | null;
  grade: string | null;
  created_at: string;
  status: ProjectStatus;
}

export interface CreateProjectRecordInput {
  name: string;
  keyword: string;
  teamName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  projectType: ProjectType;
  description?: string | null;
  competitionName?: string | null;
  semester: "1" | "2";
  year: number;
  advisorId?: number | null;
  courseId?: number | null;
  status: ProjectStatus;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateProjectRecordInput {
  name?: string;
  keyword?: string;
  teamName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  projectType?: ProjectType;
  description?: string | null;
  competitionName?: string | null;
  semester?: "1" | "2";
  year?: number;
  advisorId?: number | null;
  courseId?: number | null;
  status?: ProjectStatus;
  metadata?: Record<string, unknown> | null;
}

export interface TeamMemberRecord {
  project_id: number;
  student_id: number;
}

export interface LinkRecord {
  project_id: number;
  link: string;
}

export interface ProjectMetadata {
  keywords?: string[];
  externalLinks?: string[];
  teamMembers?: Array<{
    id?: string;
    name: string;
    email: string;
    role: string;
    isPrimary?: boolean;
  }>;
  award?: string;
  courseCode?: string;
  completionDate?: string;
  files?: Array<{
    name: string;
    size?: string;
    type?: string;
    storagePath?: string;
  }>;
  grade?: string;
  rubricId?: number;
  [key: string]: unknown;
}

export interface FileRecord {
  id: number;
  project_id: number;
  file_link: string;
}

export interface ProjectWithRelations {
  project: ProjectRecord;
  advisor?: UserRecord | null;
  students: UserRecord[];
  metadata: ProjectMetadata | null;
  links: string[];
  uploadedFiles: FileRecord[];
}

export interface ProjectQueryResult {
  data: ProjectWithRelations[] | null;
  error: PostgrestError | null;
}

const parseMetadata = (payload: unknown): ProjectMetadata | null => {
  if (!payload) {
    return null;
  }

  if (typeof payload !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as ProjectMetadata;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (_error) {
    return null;
  }

  return null;
};

export const createProjectRecord = async (
  input: CreateProjectRecordInput,
): Promise<PostgrestSingleResponse<ProjectRecord>> => {
  const supabase = getSupabaseAdminClient();

  return supabase
    .from("project")
    .insert({
      name: input.name,
      keyword: input.keyword,
      team_name: input.teamName ?? null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      project_type: input.projectType,
      description: input.description ?? null,
      competition_name: input.competitionName ?? null,
      semester: input.semester,
      year: input.year,
      advisor_id: input.advisorId ?? null,
      course_id: input.courseId ?? null,
      status: input.status,
      comment_student: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .select()
    .single();
};

export const upsertProjectStudents = async (
  projectId: number,
  studentIds: number[],
): Promise<PostgrestResponse<TeamMemberRecord>> => {
  if (studentIds.length === 0) {
    return { data: [], error: null, count: 0, status: 200, statusText: "OK" };
  }

  const supabase = getSupabaseAdminClient();

  const records = Array.from(new Set(studentIds)).map((studentId) => ({
    project_id: projectId,
    student_id: studentId,
  }));

  return supabase
    .from("team_member")
    .upsert(records, { onConflict: "student_id,project_id" })
    .select();
};

export const insertProjectLinks = async (
  projectId: number,
  links: string[],
): Promise<PostgrestResponse<LinkRecord>> => {
  if (links.length === 0) {
    return { data: [], error: null, count: 0, status: 200, statusText: "OK" };
  }

  const supabase = getSupabaseAdminClient();
  const sanitizedLinks = links.filter(
    (link) => typeof link === "string" && link.trim().length > 0,
  );

  if (sanitizedLinks.length === 0) {
    return { data: [], error: null, count: 0, status: 200, statusText: "OK" };
  }

  const records = sanitizedLinks.map((link) => ({
    project_id: projectId,
    link,
  }));
  return supabase.from("link").insert(records).select();
};

export const deleteProjectLinks = async (
  projectId: number,
): Promise<PostgrestResponse<LinkRecord>> => {
  const supabase = getSupabaseAdminClient();
  return supabase.from("link").delete().eq("project_id", projectId).select();
};

export const replaceProjectLinks = async (
  projectId: number,
  links: string[],
): Promise<{ error: PostgrestError | null }> => {
  const del = await deleteProjectLinks(projectId);
  if (del.error) return { error: del.error };
  const ins = await insertProjectLinks(projectId, links);
  return { error: ins.error };
};

const hydrateProjectsWithRelations = async (
  projects: ProjectRecord[],
): Promise<ProjectQueryResult> => {
  if (projects.length === 0) {
    return { data: [], error: null };
  }

  const supabase = getSupabaseAdminClient();
  const projectIds = projects.map((project) => project.id);

  const teamMembersResponse = await supabase
    .from("team_member")
    .select("project_id, student_id")
    .in("project_id", projectIds);

  if (teamMembersResponse.error) {
    return { data: null, error: teamMembersResponse.error };
  }

  const studentIds = Array.from(
    new Set((teamMembersResponse.data ?? []).map((item) => item.student_id)),
  );
  const advisorIds = Array.from(
    new Set(
      projects
        .map((project) => project.advisor_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const allUserIds = Array.from(new Set([...studentIds, ...advisorIds]));

  let userMap = new Map<number, UserRecord>();
  if (allUserIds.length > 0) {
    const usersResponse = await supabase
      .from("user")
      .select("id, name, email, role")
      .in("id", allUserIds);

    if (usersResponse.error) {
      return { data: null, error: usersResponse.error };
    }

    userMap = new Map(
      (usersResponse.data ?? []).map((user) => [user.id, user as UserRecord]),
    );
  }

  const linksResponse = await supabase
    .from("link")
    .select("project_id, link")
    .in("project_id", projectIds);

  if (linksResponse.error) {
    return { data: null, error: linksResponse.error };
  }

  const linksMap = new Map<number, string[]>();
  (linksResponse.data ?? []).forEach((record) => {
    const existing = linksMap.get(record.project_id) ?? [];
    existing.push(record.link);
    linksMap.set(record.project_id, existing);
  });

  // Query uploaded files from the file table
  const filesResponse = await supabase
    .from("file")
    .select("id, project_id, file_link")
    .in("project_id", projectIds);

  const uploadedFilesMap = new Map<number, FileRecord[]>();
  (filesResponse.data ?? []).forEach((record: FileRecord) => {
    const existing = uploadedFilesMap.get(record.project_id) ?? [];
    existing.push(record);
    uploadedFilesMap.set(record.project_id, existing);
  });

  const teamMembersMap = new Map<number, UserRecord[]>();
  (teamMembersResponse.data ?? []).forEach((record) => {
    const student = userMap.get(record.student_id);
    if (!student) {
      return;
    }

    const current = teamMembersMap.get(record.project_id) ?? [];
    current.push(student);
    teamMembersMap.set(record.project_id, current);
  });

  const data: ProjectWithRelations[] = projects.map((project) => ({
    project,
    advisor: project.advisor_id
      ? (userMap.get(project.advisor_id) ?? null)
      : null,
    students: teamMembersMap.get(project.id) ?? [],
    metadata: parseMetadata(project.comment_student),
    links: linksMap.get(project.id) ?? [],
    uploadedFiles: uploadedFilesMap.get(project.id) ?? [],
  }));

  return { data, error: null };
};

const wrapProjectsResponse = async (
  response: PostgrestResponse<ProjectRecord>,
): Promise<ProjectQueryResult> => {
  if (response.error) {
    return { data: null, error: response.error };
  }

  return hydrateProjectsWithRelations(response.data ?? []);
};

export const listProjectsForStudent = async (
  studentId: number,
): Promise<ProjectQueryResult> => {
  const supabase = getSupabaseAdminClient();

  const membershipResponse = await supabase
    .from("team_member")
    .select("project_id")
    .eq("student_id", studentId);

  if (membershipResponse.error) {
    return { data: null, error: membershipResponse.error };
  }

  const projectIds = (membershipResponse.data ?? []).map(
    (record) => record.project_id,
  );

  if (projectIds.length === 0) {
    return { data: [], error: null };
  }

  const projectsResponse = await supabase
    .from("project")
    .select("*")
    .in("id", projectIds)
    .order("id", { ascending: true });

  return wrapProjectsResponse(projectsResponse);
};

export const listProjectsForAdvisor = async (
  advisorId: number,
): Promise<ProjectQueryResult> => {
  const supabase = getSupabaseAdminClient();

  const projectsResponse = await supabase
    .from("project")
    .select("*")
    .eq("advisor_id", advisorId)
    .order("id", { ascending: true });

  return wrapProjectsResponse(projectsResponse);
};

export const listProjectsByCourse = async (
  courseId: number,
): Promise<ProjectQueryResult> => {
  const supabase = getSupabaseAdminClient();

  const projectsResponse = await supabase
    .from("project")
    .select("*")
    .eq("course_id", courseId)
    .order("id", { ascending: true });

  return wrapProjectsResponse(projectsResponse);
};

export const listAllProjects = async (): Promise<ProjectQueryResult> => {
  const supabase = getSupabaseAdminClient();

  const projectsResponse = await supabase
    .from("project")
    .select("*")
    .order("id", { ascending: true });

  return wrapProjectsResponse(projectsResponse);
};

export const listApprovedProjects = async (): Promise<ProjectQueryResult> => {
  const supabase = getSupabaseAdminClient();

  const projectsResponse = await supabase
    .from("project")
    .select("*")
    .eq("status", "approved")
    .order("id", { ascending: true });

  return wrapProjectsResponse(projectsResponse);
};

export const getProjectById = async (
  projectId: number,
): Promise<ProjectQueryResult> => {
  const supabase = getSupabaseAdminClient();

  const projectsResponse = await supabase
    .from("project")
    .select("*")
    .eq("id", projectId)
    .limit(1);

  const result = await wrapProjectsResponse(projectsResponse);

  if (result.data && result.data.length > 0) {
    return { data: [result.data[0]], error: null };
  }

  return result;
};

export const updateProjectGrade = async (
  projectId: number,
  grade: string | null,
  metadata: ProjectMetadata | null,
): Promise<PostgrestSingleResponse<ProjectRecord>> => {
  const supabase = getSupabaseAdminClient();

  const updatedMetadata: ProjectMetadata = { ...(metadata ?? {}) };

  if (grade) {
    updatedMetadata.grade = grade;
  } else {
    delete updatedMetadata.grade;
  }

  const payload: Partial<ProjectRecord> = {
    comment_student:
      Object.keys(updatedMetadata).length > 0
        ? JSON.stringify(updatedMetadata)
        : null,
    grade: null,
  };

  return supabase
    .from("project")
    .update(payload)
    .eq("id", projectId)
    .select()
    .single();
};

export const updateProjectRecord = async (
  projectId: number,
  input: UpdateProjectRecordInput,
): Promise<PostgrestSingleResponse<ProjectRecord>> => {
  const supabase = getSupabaseAdminClient();

  const payload: Partial<ProjectRecord> = {};

  if (input.name !== undefined) payload.name = input.name;
  if (input.keyword !== undefined) payload.keyword = input.keyword;
  if (input.teamName !== undefined) payload.team_name = input.teamName ?? null;
  if (input.startDate !== undefined)
    payload.start_date = input.startDate ?? null;
  if (input.endDate !== undefined) payload.end_date = input.endDate ?? null;
  if (input.projectType !== undefined) payload.project_type = input.projectType;
  if (input.description !== undefined)
    payload.description = input.description ?? null;
  if (input.competitionName !== undefined)
    payload.competition_name = input.competitionName ?? null;
  if (input.semester !== undefined) payload.semester = input.semester;
  if (input.year !== undefined) payload.year = input.year;
  if (input.advisorId !== undefined)
    payload.advisor_id = input.advisorId ?? null;
  if (input.courseId !== undefined) payload.course_id = input.courseId ?? null;
  if (input.status !== undefined) payload.status = input.status;

  if (input.metadata !== undefined) {
    payload.comment_student = input.metadata
      ? JSON.stringify(input.metadata)
      : null;
  }

  return supabase
    .from("project")
    .update(payload)
    .eq("id", projectId)
    .select()
    .single();
};

export const updateProjectFeedback = async (
  projectId: number,
  payload: {
    advisorFeedback?: string | null;
    coordinatorFeedback?: string | null;
  },
): Promise<PostgrestSingleResponse<ProjectRecord>> => {
  const supabase = getSupabaseAdminClient();

  const updatePayload: Partial<ProjectRecord> = {};

  if (payload.advisorFeedback !== undefined) {
    updatePayload.feedback_advisor = payload.advisorFeedback;
  }

  if (payload.coordinatorFeedback !== undefined) {
    updatePayload.feedback_coordinator = payload.coordinatorFeedback;
  }

  return supabase
    .from("project")
    .update(updatePayload)
    .eq("id", projectId)
    .select()
    .single();
};

export const updateProjectStatus = async (
  projectId: number,
  status: ProjectStatus,
): Promise<PostgrestSingleResponse<ProjectRecord>> => {
  const supabase = getSupabaseAdminClient();

  return supabase
    .from("project")
    .update({ status })
    .eq("id", projectId)
    .select()
    .single();
};
