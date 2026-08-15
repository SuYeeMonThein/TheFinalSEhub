import { Router, Response, NextFunction } from "express";
import multer from "multer";
import { AuthedRequest, verifyFirebaseAuth } from "../middleware/auth";
import {
  createProjectRecord,
  getProjectById,
  insertProjectLinks,
  replaceProjectLinks,
  listAllProjects,
  listApprovedProjects,
  listProjectsForAdvisor,
  listProjectsForStudent,
  ProjectMetadata,
  ProjectStatus,
  ProjectType,
  ProjectWithRelations,
  upsertProjectStudents,
  updateProjectGrade,
  updateProjectFeedback,
  updateProjectStatus,
  updateProjectRecord,
} from "../services/projectService";
import { findUserByEmail, UserRecord } from "../services/userService";
import { getSupabaseAdminClient } from "../services/supabaseClient";
import { uploadFile, downloadFile } from "../services/storage";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "application/zip",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed.`));
    }
  },
});

const projectsRouter = Router();

const DISPLAY_TYPE_MAP: Record<ProjectType, string> = {
  academic: "Capstone",
  competition: "Competition Work",
  service: "Social Service",
  other: "Other",
};

const DISPLAY_STATUS_MAP: Record<ProjectStatus, string> = {
  draft: "Draft",
  underreview: "Under Review",
  approved: "Approved",
  reject: "Rejected",
};

const PROJECT_TYPE_LOOKUP: Record<string, ProjectType> = {
  capstone: "academic",
  "academic publication": "academic",
  "competition work": "competition",
  competition: "competition",
  "social service": "service",
  service: "service",
  other: "other",
};

const PROJECT_STATUS_LOOKUP: Record<string, ProjectStatus> = {
  draft: "draft",
  "under review": "underreview",
  submitted: "underreview",
  "in review": "underreview",
  approved: "approved",
  completed: "approved",
  reject: "reject",
  rejected: "reject",
  deny: "reject",
};

const KEYWORD_LOOKUP: Record<string, string> = {
  ai: "ai",
  service: "service",
  game: "game",
  gaming: "game",
  health: "health",
  academic: "academic",
  research: "academic",
  other: "other",
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
};

const normalizeProjectType = (value: unknown): ProjectType => {
  const candidate = normalizeString(value);
  if (!candidate) {
    return "other";
  }

  const normalizedKey = candidate.toLowerCase();
  return PROJECT_TYPE_LOOKUP[normalizedKey] ?? "other";
};

const normalizeProjectStatus = (value: unknown): ProjectStatus => {
  const candidate = normalizeString(value);
  if (!candidate) {
    return "underreview";
  }

  const normalizedKey = candidate.toLowerCase();
  return PROJECT_STATUS_LOOKUP[normalizedKey] ?? "underreview";
};

const GRADE_VALUES = ["A", "B+", "B", "C+", "C", "D+", "D", "F"] as const;
const isValidGrade = (value: string): value is (typeof GRADE_VALUES)[number] =>
  GRADE_VALUES.includes(value as (typeof GRADE_VALUES)[number]);

const normalizeSemester = (value: unknown): "1" | "2" => {
  const candidate = normalizeString(value);
  if (!candidate) {
    return "1";
  }

  const normalizedKey = candidate.toLowerCase();
  if (normalizedKey.includes("2")) {
    return "2";
  }

  return "1";
};

const resolveKeyword = (keywords: string[]): string => {
  if (keywords.length === 0) {
    return "other";
  }

  for (const candidate of keywords) {
    const normalized = candidate.toLowerCase();
    if (KEYWORD_LOOKUP[normalized]) {
      return KEYWORD_LOOKUP[normalized];
    }
  }

  return "other";
};

interface SubmittedTeamMember {
  id?: string;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  isPrimary?: unknown;
}

interface NormalizedTeamMember {
  id?: string;
  name: string;
  email: string;
  role: "student" | "lecturer";
  isPrimary: boolean;
}

interface SubmittedFileSummary {
  name?: unknown;
  size?: unknown;
  type?: unknown;
}

const normalizeFiles = (
  value: unknown,
): Array<{ name: string; size?: string; type?: string }> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const files: Array<{ name: string; size?: string; type?: string }> = [];

  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const candidate = entry as SubmittedFileSummary;
    const name = normalizeString(candidate.name);

    if (!name) {
      return;
    }

    files.push({
      name,
      size: typeof candidate.size === "string" ? candidate.size : undefined,
      type: typeof candidate.type === "string" ? candidate.type : undefined,
    });
  });

  return files;
};

const normalizeTeamMembers = (value: unknown): NormalizedTeamMember[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const teamMembers: NormalizedTeamMember[] = [];

  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const candidate = entry as SubmittedTeamMember;
    const name = normalizeString(candidate.name) ?? "";
    const email = normalizeString(candidate.email);
    const role = normalizeString(candidate.role);
    const roleKey = role ? role.toLowerCase() : "student";

    if (!email || (roleKey !== "student" && roleKey !== "lecturer")) {
      return;
    }

    teamMembers.push({
      id: typeof candidate.id === "string" ? candidate.id : undefined,
      name,
      email,
      role: roleKey === "lecturer" ? "lecturer" : "student",
      isPrimary: Boolean(candidate.isPrimary),
    });
  });

  return teamMembers;
};

const ensureSubmitterMember = (
  submitter: UserRecord,
  members: NormalizedTeamMember[],
): NormalizedTeamMember[] => {
  const exists = members.some(
    (member) => member.email.toLowerCase() === submitter.email.toLowerCase(),
  );

  if (exists) {
    return members;
  }

  return [
    {
      id: submitter.id.toString(),
      name: submitter.name,
      email: submitter.email,
      role: "student",
      isPrimary: members.every((member) => !member.isPrimary),
    },
    ...members,
  ];
};

const pickAdvisorFromMembers = (
  members: NormalizedTeamMember[],
): NormalizedTeamMember | null => {
  const advisor = members.find((member) => member.role === "lecturer");
  return advisor ?? null;
};

const formatProjectResponse = (record: ProjectWithRelations) => {
  const { project, advisor, students, metadata, links, uploadedFiles } = record;

  const parsedMetadata: ProjectMetadata = metadata ?? {};
  const keywords = Array.isArray(parsedMetadata.keywords)
    ? parsedMetadata.keywords.filter((keyword) => typeof keyword === "string")
    : [];
  const externalLinks = Array.isArray(parsedMetadata.externalLinks)
    ? parsedMetadata.externalLinks.filter((link) => typeof link === "string")
    : links;
  const teamMembers = Array.isArray(parsedMetadata.teamMembers)
    ? parsedMetadata.teamMembers.filter(
        (member) =>
          typeof member === "object" &&
          member !== null &&
          typeof member.email === "string",
      )
    : [];

  // Build files list: start with metadata files, then enrich with file table data
  const metadataFiles = Array.isArray(parsedMetadata.files)
    ? parsedMetadata.files.filter(
        (file) => typeof file === "object" && file !== null,
      )
    : [];

  // Build a lookup of file_link → true for files in the file table
  const fileTablePaths = new Set((uploadedFiles ?? []).map((f) => f.file_link));

  // Merge: mark metadata files as downloadable if they have a storagePath in file table
  const files = metadataFiles.map((f: any) => {
    const hasStorage = !!(f.storagePath && fileTablePaths.has(f.storagePath));
    return {
      name: f.name,
      size: f.size,
      type: f.type,
      storagePath: f.storagePath ?? null,
      downloadable: hasStorage,
    };
  });

  // Also add any file table entries not already represented in metadata
  for (const dbFile of uploadedFiles ?? []) {
    const alreadyListed = files.some(
      (f: any) => f.storagePath === dbFile.file_link,
    );
    if (!alreadyListed) {
      const fileName = dbFile.file_link.split("/").pop() ?? dbFile.file_link;
      // Strip timestamp prefix (e.g., "1234567890_filename.pdf" -> "filename.pdf")
      const cleanName = fileName.replace(/^\d+_/, "");
      files.push({
        name: cleanName,
        size: undefined,
        type: undefined,
        storagePath: dbFile.file_link,
        downloadable: true,
      });
    }
  }

  const metadataGrade =
    typeof parsedMetadata.grade === "string" ? parsedMetadata.grade : null;
  const metadataRubricId =
    typeof parsedMetadata.rubricId === "number"
      ? parsedMetadata.rubricId
      : typeof parsedMetadata.rubricId === "string"
        ? Number(parsedMetadata.rubricId)
        : null;

  const semesterLabel = project.semester === "2" ? "Semester 2" : "Semester 1";

  return {
    id: project.id,
    title: project.name,
    type: DISPLAY_TYPE_MAP[project.project_type] ?? "Other",
    status: DISPLAY_STATUS_MAP[project.status] ?? "Under Review",
    submissionDate: project.start_date,
    lastModified: project.end_date,
    description: project.description ?? "",
    students: students.map((student) => student.name),
    studentDetails: students.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
    })),
    advisor: advisor?.name ?? "",
    advisorEmail: advisor?.email ?? "",
    teamName: project.team_name ?? "",
    keywords,
    competitionName: project.competition_name ?? null,
    award:
      typeof parsedMetadata.award === "string" ? parsedMetadata.award : null,
    externalLinks,
    files,
    teamMembers,
    semester: semesterLabel,
    year: project.year?.toString() ?? "",
    courseCode:
      typeof parsedMetadata.courseCode === "string"
        ? parsedMetadata.courseCode
        : null,
    completionDate:
      typeof parsedMetadata.completionDate === "string"
        ? parsedMetadata.completionDate
        : project.end_date,
    impact: "Medium",
    grade: metadataGrade ?? project.grade ?? null,
    rubricId:
      metadataRubricId && Number.isFinite(metadataRubricId)
        ? metadataRubricId
        : null,
    feedback: {
      advisor: project.feedback_advisor,
      coordinator: project.feedback_coordinator,
    },
  };
};

const formatProjectCollection = (
  records: ProjectWithRelations[] | null | undefined,
) => {
  if (!records || records.length === 0) {
    return [];
  }

  return records.map((record) => formatProjectResponse(record));
};

const mapYearFromDate = (date: string | null): number => {
  if (!date) {
    return new Date().getFullYear();
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().getFullYear();
  }

  return parsed.getFullYear();
};

projectsRouter.post(
  "/",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;
    const emailFromToken = req.user?.email;

    if (role !== "student") {
      res.status(403).json({ error: "Only students can submit projects." });
      return;
    }

    if (!emailFromToken) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const submitterResponse = await findUserByEmail(emailFromToken);

    if (submitterResponse.error) {
      res.status(500).json({ error: submitterResponse.error.message });
      return;
    }

    const submitter = submitterResponse.data;

    if (!submitter) {
      res.status(404).json({ error: "Student record not found." });
      return;
    }

    const {
      title,
      description,
      type,
      keywords: rawKeywords,
      teamName,
      status,
      semester,
      competitionName,
      award,
      externalLinks: rawExternalLinks,
      teamMembers: rawTeamMembers,
      courseCode,
      completionDate,
      files: rawFiles,
    } = req.body ?? {};

    const normalizedTitle = normalizeString(title);
    const normalizedDescription = normalizeString(description);

    if (!normalizedTitle || !normalizedDescription) {
      res
        .status(400)
        .json({ error: "Both title and description are required." });
      return;
    }

    const keywords = normalizeStringArray(rawKeywords);
    const externalLinks = normalizeStringArray(rawExternalLinks);
    const normalizedMembers = ensureSubmitterMember(
      submitter,
      normalizeTeamMembers(rawTeamMembers),
    );

    if (normalizedMembers.every((member) => !member.isPrimary)) {
      normalizedMembers[0].isPrimary = true;
    }

    const advisorCandidate = pickAdvisorFromMembers(normalizedMembers);
    let advisorRecord: UserRecord | null = null;

    if (advisorCandidate) {
      const advisorResponse = await findUserByEmail(advisorCandidate.email);
      if (advisorResponse.error) {
        res.status(500).json({ error: advisorResponse.error.message });
        return;
      }

      advisorRecord = advisorResponse.data ?? null;
    }

    const studentEmails = normalizedMembers
      .filter((member) => member.role === "student")
      .map((member) => member.email.toLowerCase());

    const uniqueStudentEmails = Array.from(
      new Set([submitter.email.toLowerCase(), ...studentEmails]),
    );

    const studentIdPromises = uniqueStudentEmails.map(async (email) => {
      const response = await findUserByEmail(email);
      if (response.error || !response.data) {
        return null;
      }

      return response.data;
    });

    const studentRecords = await Promise.all(studentIdPromises);
    const existingStudents = studentRecords.filter(
      (record): record is UserRecord => Boolean(record),
    );

    const studentIds = existingStudents.map((student) => student.id);

    if (studentIds.length === 0) {
      res.status(400).json({
        error: "No valid student members found for project submission.",
      });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const normalizedStatus = normalizeProjectStatus(status ?? "Under Review");
    const normalizedType = normalizeProjectType(type);
    const normalizedSemester = normalizeSemester(semester ?? "Semester 1");
    const keyword = resolveKeyword(keywords);
    const projectYear = mapYearFromDate(completionDate ?? today);
    const files = normalizeFiles(rawFiles);

    const metadata: ProjectMetadata = {
      keywords,
      externalLinks,
      teamMembers: normalizedMembers,
      award: normalizeString(award) ?? undefined,
      courseCode: normalizeString(courseCode) ?? undefined,
      completionDate: normalizeString(completionDate) ?? undefined,
      files: files.length > 0 ? files : undefined,
    };

    // Find course by courseCode if provided
    let courseId: number | null = null;
    const normalizedCourseCode = normalizeString(courseCode);

    if (normalizedCourseCode) {
      const supabase = getSupabaseAdminClient();
      const { data: course } = await supabase
        .from("course")
        .select("id")
        .eq("course_code", normalizedCourseCode)
        .single();

      if (course) {
        courseId = course.id;
      }
    }

    const createResponse = await createProjectRecord({
      name: normalizedTitle,
      keyword,
      teamName: normalizeString(teamName),
      startDate: today,
      endDate: normalizeString(completionDate) ?? today,
      projectType: normalizedType,
      description: normalizedDescription,
      competitionName: normalizeString(competitionName),
      semester: normalizedSemester,
      year: projectYear,
      advisorId: advisorRecord?.id ?? null,
      courseId: courseId,
      status: normalizedStatus,
      metadata,
    });

    if (createResponse.error || !createResponse.data) {
      res.status(500).json({
        error: createResponse.error?.message ?? "Failed to create project.",
      });
      return;
    }

    const projectId = createResponse.data.id;

    const studentLinkResponse = await upsertProjectStudents(
      projectId,
      studentIds,
    );

    if (studentLinkResponse.error) {
      const supabase = getSupabaseAdminClient();
      await supabase.from("project").delete().eq("id", projectId);
      res.status(500).json({ error: studentLinkResponse.error.message });
      return;
    }

    const linkResponse = await insertProjectLinks(projectId, externalLinks);

    if (linkResponse.error) {
      const supabase = getSupabaseAdminClient();
      try {
        await supabase.from("team_member").delete().eq("project_id", projectId);
      } catch (_error) {
        // ignore cleanup failures
      }

      await supabase.from("project").delete().eq("id", projectId);
      res.status(500).json({ error: linkResponse.error.message });
      return;
    }

    const projectResult = await getProjectById(projectId);

    if (projectResult.error) {
      res.status(500).json({ error: projectResult.error.message });
      return;
    }

    const [project] = projectResult.data ?? [];

    res
      .status(201)
      .json({ project: project ? formatProjectResponse(project) : null });
  },
);

// Project members (students, coordinators) update project fields/metadata — advisors cannot edit
projectsRouter.patch(
  "/:projectId",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;
    const requesterEmail = req.user?.email;
    const { projectId } = req.params;

    if (role === "advisor") {
      res
        .status(403)
        .json({ error: "Advisors cannot update project details." });
      return;
    }

    if (!requesterEmail) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const numericProjectId = Number(projectId);
    if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
      res.status(400).json({ error: "Invalid project identifier." });
      return;
    }

    const requesterLookup = await findUserByEmail(requesterEmail);
    if (requesterLookup.error) {
      res.status(500).json({ error: requesterLookup.error.message });
      return;
    }

    const requester = requesterLookup.data;
    if (!requester) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const projectResult = await getProjectById(numericProjectId);
    if (projectResult.error) {
      res.status(500).json({ error: projectResult.error.message });
      return;
    }
    const projectRecord = projectResult.data?.[0];
    if (!projectRecord) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const supabase = getSupabaseAdminClient();

    // Coordinators can edit any project; students must be a team member
    if (role === "student") {
      const membership = await supabase
        .from("team_member")
        .select("project_id")
        .eq("project_id", numericProjectId)
        .eq("student_id", requester.id)
        .maybeSingle();

      if (membership.error) {
        res.status(500).json({ error: membership.error.message });
        return;
      }

      if (!membership.data) {
        res
          .status(403)
          .json({ error: "You are not a member of this project." });
        return;
      }
    }

    // Normalize inputs
    const {
      title,
      description,
      type,
      keywords: rawKeywords,
      teamName,
      status,
      semester,
      competitionName,
      award,
      externalLinks: rawExternalLinks,
      teamMembers: rawTeamMembers,
      courseCode,
      completionDate,
      files: rawFiles,
    } = req.body ?? {};

    const normalizedTitle = normalizeString(title);
    const keywords = normalizeStringArray(rawKeywords);
    const externalLinks = normalizeStringArray(rawExternalLinks);
    const normalizedMembers = normalizeTeamMembers(rawTeamMembers);
    const files = normalizeFiles(rawFiles);

    // Extract advisor from team members if present
    const advisorCandidate = pickAdvisorFromMembers(normalizedMembers);
    let advisorRecord: UserRecord | null = null;

    if (advisorCandidate) {
      const advisorResponse = await findUserByEmail(advisorCandidate.email);
      if (advisorResponse.error) {
        res.status(500).json({ error: advisorResponse.error.message });
        return;
      }
      advisorRecord = advisorResponse.data ?? null;
    }

    const updatedMetadata: ProjectMetadata = {
      ...(projectRecord.metadata ?? {}),
      keywords,
      externalLinks,
      teamMembers: normalizedMembers,
      award: normalizeString(award) ?? undefined,
      courseCode: normalizeString(courseCode) ?? undefined,
      completionDate: normalizeString(completionDate) ?? undefined,
      files: files.length > 0 ? files : undefined,
    };

    // Map course code to course id if provided
    let resolvedCourseId: number | undefined;
    const normalizedCourseCode = normalizeString(courseCode);
    if (normalizedCourseCode) {
      const { data: course } = await supabase
        .from("course")
        .select("id")
        .eq("course_code", normalizedCourseCode)
        .single();
      if (course) {
        resolvedCourseId = course.id;
      }
    }

    const updatePayload = {
      name: normalizedTitle ?? undefined,
      description: normalizeString(description) ?? undefined,
      projectType: type ? normalizeProjectType(type) : undefined,
      teamName: normalizeString(teamName) ?? undefined,
      status: status ? normalizeProjectStatus(status) : undefined,
      semester: semester ? normalizeSemester(semester) : undefined,
      competitionName: normalizeString(competitionName) ?? undefined,
      endDate: normalizeString(completionDate) ?? undefined,
      courseId: resolvedCourseId,
      advisorId: advisorRecord?.id ?? null,
      metadata: updatedMetadata,
    } as const;

    const updateResult = await updateProjectRecord(
      numericProjectId,
      updatePayload,
    );
    if (updateResult.error) {
      res.status(500).json({ error: updateResult.error.message });
      return;
    }

    const linkResult = await replaceProjectLinks(
      numericProjectId,
      externalLinks,
    );
    if (linkResult.error) {
      res.status(500).json({ error: linkResult.error.message });
      return;
    }

    const refreshed = await getProjectById(numericProjectId);
    if (refreshed.error) {
      res.status(500).json({ error: refreshed.error.message });
      return;
    }

    const [project] = refreshed.data ?? [];
    res.json({ project: project ? formatProjectResponse(project) : null });
  },
);

projectsRouter.patch(
  "/:projectId/grade",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;
    const requesterEmail = req.user?.email;
    const { projectId } = req.params;

    if (role !== "advisor") {
      res.status(403).json({ error: "Only advisors can update grades." });
      return;
    }

    if (!requesterEmail) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const numericProjectId = Number(projectId);

    if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
      res.status(400).json({ error: "Invalid project identifier." });
      return;
    }

    const gradeRaw =
      typeof req.body?.grade === "string"
        ? req.body.grade.trim().toUpperCase()
        : "";
    const gradeInput = gradeRaw.length > 0 ? gradeRaw : null;

    if (gradeInput && !isValidGrade(gradeInput)) {
      res.status(400).json({ error: "Unsupported grade value." });
      return;
    }

    const advisorLookup = await findUserByEmail(requesterEmail);

    if (advisorLookup.error) {
      res.status(500).json({ error: advisorLookup.error.message });
      return;
    }

    const advisorRecord = advisorLookup.data;

    if (!advisorRecord) {
      res.status(404).json({ error: "Advisor record not found." });
      return;
    }

    const projectResult = await getProjectById(numericProjectId);

    if (projectResult.error) {
      res.status(500).json({ error: projectResult.error.message });
      return;
    }

    const projectRecord = projectResult.data?.[0];

    if (!projectRecord) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (projectRecord.project.advisor_id !== advisorRecord.id) {
      res.status(403).json({
        error: "You are not assigned as the advisor for this project.",
      });
      return;
    }

    const existingGrade =
      typeof projectRecord.metadata?.grade === "string"
        ? projectRecord.metadata.grade
        : null;

    if (existingGrade === gradeInput) {
      res.json({ project: formatProjectResponse(projectRecord) });
      return;
    }

    const updateResponse = await updateProjectGrade(
      numericProjectId,
      gradeInput,
      projectRecord.metadata ?? null,
    );

    if (updateResponse.error) {
      console.error("[projects] failed to update grade", {
        projectId: numericProjectId,
        grade: gradeInput,
        message: updateResponse.error.message,
      });
      res.status(500).json({ error: updateResponse.error.message });
      return;
    }

    const refreshedProject = await getProjectById(numericProjectId);

    if (refreshedProject.error) {
      console.error("[projects] failed to reload project after grade update", {
        projectId: numericProjectId,
        message: refreshedProject.error.message,
      });
      res.status(500).json({ error: refreshedProject.error.message });
      return;
    }

    const [project] = refreshedProject.data ?? [];

    res.json({ project: project ? formatProjectResponse(project) : null });
  },
);

projectsRouter.patch(
  "/:projectId/rubric",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;
    const requesterEmail = req.user?.email;
    const { projectId } = req.params;

    if (role !== "advisor") {
      res.status(403).json({ error: "Only advisors can assign rubrics." });
      return;
    }

    if (!requesterEmail) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const numericProjectId = Number(projectId);

    if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
      res.status(400).json({ error: "Invalid project identifier." });
      return;
    }

    const rubricId =
      typeof req.body?.rubricId === "number"
        ? req.body.rubricId
        : typeof req.body?.rubricId === "string"
          ? Number(req.body.rubricId)
          : NaN;

    if (!Number.isFinite(rubricId) || rubricId <= 0) {
      res.status(400).json({ error: "Valid rubricId is required." });
      return;
    }

    const advisorLookup = await findUserByEmail(requesterEmail);

    if (advisorLookup.error) {
      res.status(500).json({ error: advisorLookup.error.message });
      return;
    }

    const advisorRecord = advisorLookup.data;

    if (!advisorRecord) {
      res.status(404).json({ error: "Advisor record not found." });
      return;
    }

    const projectResult = await getProjectById(numericProjectId);

    if (projectResult.error) {
      res.status(500).json({ error: projectResult.error.message });
      return;
    }

    const projectRecord = projectResult.data?.[0];

    if (!projectRecord) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (projectRecord.project.advisor_id !== advisorRecord.id) {
      res.status(403).json({
        error: "You are not assigned as the advisor for this project.",
      });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: rubric, error: rubricError } = await supabase
      .from("rubric")
      .select("id, is_active")
      .eq("id", rubricId)
      .maybeSingle();

    if (rubricError) {
      res.status(500).json({ error: rubricError.message });
      return;
    }

    if (!rubric) {
      res.status(404).json({ error: "Rubric not found." });
      return;
    }

    if (!rubric.is_active) {
      res.status(400).json({ error: "Only active rubrics can be assigned." });
      return;
    }

    const updatedMetadata: ProjectMetadata = {
      ...(projectRecord.metadata ?? {}),
      rubricId,
    };

    const updateResult = await updateProjectRecord(numericProjectId, {
      metadata: updatedMetadata,
    });

    if (updateResult.error) {
      res.status(500).json({ error: updateResult.error.message });
      return;
    }

    const refreshedProject = await getProjectById(numericProjectId);

    if (refreshedProject.error) {
      res.status(500).json({ error: refreshedProject.error.message });
      return;
    }

    const [project] = refreshedProject.data ?? [];

    res.json({ project: project ? formatProjectResponse(project) : null });
  },
);

projectsRouter.patch(
  "/:projectId/feedback",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;
    const requesterEmail = req.user?.email;
    const { projectId } = req.params;

    if (role !== "advisor" && role !== "coordinator") {
      res
        .status(403)
        .json({ error: "Only advisors or coordinators can update feedback." });
      return;
    }

    if (!requesterEmail) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const numericProjectId = Number(projectId);

    if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
      res.status(400).json({ error: "Invalid project identifier." });
      return;
    }

    const feedbackText =
      typeof req.body?.feedback === "string" ? req.body.feedback.trim() : "";

    if (feedbackText.length === 0) {
      res.status(400).json({ error: "Feedback text is required." });
      return;
    }

    const requesterLookup = await findUserByEmail(requesterEmail);

    if (requesterLookup.error) {
      res.status(500).json({ error: requesterLookup.error.message });
      return;
    }

    const requesterRecord = requesterLookup.data;

    if (!requesterRecord) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const projectResult = await getProjectById(numericProjectId);

    if (projectResult.error) {
      res.status(500).json({ error: projectResult.error.message });
      return;
    }

    const projectRecord = projectResult.data?.[0];

    if (!projectRecord) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (
      role === "advisor" &&
      projectRecord.project.advisor_id !== requesterRecord.id
    ) {
      res.status(403).json({
        error: "You are not assigned as the advisor for this project.",
      });
      return;
    }

    const updateResponse = await updateProjectFeedback(numericProjectId, {
      advisorFeedback: role === "advisor" ? feedbackText : undefined,
      coordinatorFeedback: role === "coordinator" ? feedbackText : undefined,
    });

    if (updateResponse.error) {
      res.status(500).json({ error: updateResponse.error.message });
      return;
    }

    const refreshedProject = await getProjectById(numericProjectId);

    if (refreshedProject.error) {
      res.status(500).json({ error: refreshedProject.error.message });
      return;
    }

    const [project] = refreshedProject.data ?? [];

    res.json({ project: project ? formatProjectResponse(project) : null });
  },
);

projectsRouter.patch(
  "/:projectId/status",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;
    const requesterEmail = req.user?.email;
    const { projectId } = req.params;

    if (role !== "advisor" && role !== "coordinator") {
      res.status(403).json({
        error: "Only advisors or coordinators can update project status.",
      });
      return;
    }

    if (!requesterEmail) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const numericProjectId = Number(projectId);

    if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
      res.status(400).json({ error: "Invalid project identifier." });
      return;
    }

    const statusValue =
      typeof req.body?.status === "string" ? req.body.status.trim() : "";

    if (statusValue.length === 0) {
      res.status(400).json({ error: "Status value is required." });
      return;
    }

    const normalizedStatus = normalizeProjectStatus(statusValue);

    const requesterLookup = await findUserByEmail(requesterEmail);

    if (requesterLookup.error) {
      res.status(500).json({ error: requesterLookup.error.message });
      return;
    }

    const requesterRecord = requesterLookup.data;

    if (!requesterRecord) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const projectResult = await getProjectById(numericProjectId);

    if (projectResult.error) {
      res.status(500).json({ error: projectResult.error.message });
      return;
    }

    const projectRecord = projectResult.data?.[0];

    if (!projectRecord) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    if (
      role === "advisor" &&
      projectRecord.project.advisor_id !== requesterRecord.id
    ) {
      res.status(403).json({
        error: "You are not assigned as the advisor for this project.",
      });
      return;
    }

    const updateResponse = await updateProjectStatus(
      numericProjectId,
      normalizedStatus,
    );

    if (updateResponse.error) {
      res.status(500).json({ error: updateResponse.error.message });
      return;
    }

    const refreshedProject = await getProjectById(numericProjectId);

    if (refreshedProject.error) {
      res.status(500).json({ error: refreshedProject.error.message });
      return;
    }

    const [project] = refreshedProject.data ?? [];

    res.json({ project: project ? formatProjectResponse(project) : null });
  },
);

projectsRouter.get(
  "/",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const emailFromToken = req.user?.email;

      if (!emailFromToken) {
        res
          .status(400)
          .json({ error: "Email address missing from authentication token." });
        return;
      }

      const userResponse = await findUserByEmail(emailFromToken);

      if (userResponse.error) {
        console.error(
          "[GET /projects] findUserByEmail error:",
          userResponse.error,
        );
        res.status(500).json({ error: userResponse.error.message });
        return;
      }

      const user = userResponse.data;

      if (!user) {
        res.status(404).json({ error: "User record not found." });
        return;
      }

      const role = req.user?.role ?? user.role;
      let projectsResult;

      if (role === "student") {
        projectsResult = await listProjectsForStudent(user.id);
      } else if (role === "advisor") {
        projectsResult = await listProjectsForAdvisor(user.id);
      } else {
        projectsResult = await listAllProjects();
      }

      if (projectsResult.error) {
        console.error("[GET /projects] query error:", projectsResult.error);
        res.status(500).json({ error: projectsResult.error.message });
        return;
      }

      res.json({ projects: formatProjectCollection(projectsResult.data) });
    } catch (err) {
      console.error("[GET /projects] unhandled error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

/**
 * @openapi
 * /projects/archive:
 *   get:
 *     summary: Get all approved projects (archive) — accessible by any authenticated user
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of approved projects
 */
projectsRouter.get(
  "/archive",
  verifyFirebaseAuth,
  async (_req: AuthedRequest, res: Response) => {
    try {
      const projectsResult = await listApprovedProjects();

      if (projectsResult.error) {
        console.error(
          "[GET /projects/archive] query error:",
          projectsResult.error,
        );
        res.status(500).json({ error: projectsResult.error.message });
        return;
      }

      res.json({ projects: formatProjectCollection(projectsResult.data) });
    } catch (err) {
      console.error("[GET /projects/archive] unhandled error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  FILE UPLOAD — POST /projects/:id/files                            */
/* ------------------------------------------------------------------ */

/**
 * @openapi
 * /projects/{id}/files:
 *   post:
 *     summary: Upload one or more files for a project
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       '200':
 *         description: Files uploaded successfully
 */
projectsRouter.post(
  "/:id/files",
  verifyFirebaseAuth,
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    upload.array("files", 10)(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res
            .status(413)
            .json({ error: "File too large. Maximum size is 20 MB." });
          return;
        }
        if (err.message?.includes("not allowed")) {
          res.status(415).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: "File upload error." });
        return;
      }
      next();
    });
  },
  async (req: AuthedRequest, res: Response) => {
    try {
      const projectId = parseInt(req.params.id, 10);

      if (Number.isNaN(projectId)) {
        res.status(400).json({ error: "Invalid project id." });
        return;
      }

      const uploadedFiles = (req as any).files as
        | Array<{
            fieldname: string;
            originalname: string;
            encoding: string;
            mimetype: string;
            size: number;
            buffer: Buffer;
          }>
        | undefined;

      if (!uploadedFiles || uploadedFiles.length === 0) {
        res.status(400).json({ error: "No files provided." });
        return;
      }

      // Verify the project exists
      const projectResult = await getProjectById(projectId);
      if (
        projectResult.error ||
        !projectResult.data ||
        projectResult.data.length === 0
      ) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const uploadedFileSummaries: Array<{
        name: string;
        size: string;
        type: string;
        storagePath: string;
      }> = [];

      for (const file of uploadedFiles) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `projects/${projectId}/${Date.now()}_${safeName}`;

        await uploadFile(storagePath, file.buffer, file.mimetype);

        uploadedFileSummaries.push({
          name: file.originalname,
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          type: file.mimetype.split("/")[1]?.toUpperCase() ?? "FILE",
          storagePath,
        });
      }

      // Update project metadata with the file information
      const record = projectResult.data[0];
      const existingMetadata: ProjectMetadata = record.metadata ?? {};
      const existingFiles = Array.isArray(existingMetadata.files)
        ? existingMetadata.files
        : [];

      // Replace metadata entries that match by name, keep the rest
      const uploadedNames = new Set(uploadedFileSummaries.map((f) => f.name));
      const keptFiles = existingFiles.filter(
        (f: any) => !uploadedNames.has(f.name),
      );
      const updatedFiles = [...keptFiles, ...uploadedFileSummaries];
      const updatedMetadata = { ...existingMetadata, files: updatedFiles };

      const supabase = getSupabaseAdminClient();
      await supabase
        .from("project")
        .update({ comment_student: JSON.stringify(updatedMetadata) })
        .eq("id", projectId);

      // Also insert into the file table for each uploaded file
      const fileTableRecords = uploadedFileSummaries.map((f) => ({
        project_id: projectId,
        file_link: f.storagePath,
      }));
      await supabase.from("file").insert(fileTableRecords);

      res.json({ files: uploadedFileSummaries });
    } catch (err) {
      console.error("[POST /projects/:id/files] error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  },
);

/* ------------------------------------------------------------------ */
/*  FILE DOWNLOAD — GET /projects/:id/files/:filename                 */
/*  Accessible by ANY authenticated user (all roles)                  */
/* ------------------------------------------------------------------ */

/**
 * @openapi
 * /projects/{id}/files/{filename}:
 *   get:
 *     summary: Download a project attachment file (any authenticated role)
 *     tags:
 *       - Projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: File content
 *       '404':
 *         description: File not found
 */
projectsRouter.get(
  "/:id/files/:filename",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const projectId = parseInt(req.params.id, 10);
      const requestedFilename = decodeURIComponent(req.params.filename);

      if (Number.isNaN(projectId)) {
        res.status(400).json({ error: "Invalid project id." });
        return;
      }

      // Fetch project to find the file's storage path
      const projectResult = await getProjectById(projectId);
      if (
        projectResult.error ||
        !projectResult.data ||
        projectResult.data.length === 0
      ) {
        res.status(404).json({ error: "Project not found." });
        return;
      }

      const record = projectResult.data[0];
      const metadata: ProjectMetadata = record.metadata ?? {};
      const metadataFiles = Array.isArray(metadata.files) ? metadata.files : [];

      // 1. Try finding the file via storagePath in metadata
      let storagePath: string | null = null;

      const metadataEntry = metadataFiles.find(
        (f: any) => f.name === requestedFilename && f.storagePath,
      );
      if (metadataEntry && (metadataEntry as any).storagePath) {
        storagePath = (metadataEntry as any).storagePath as string;
      }

      // 2. Fall back to the file table
      if (!storagePath) {
        const supabase = getSupabaseAdminClient();
        const { data: fileRows } = await supabase
          .from("file")
          .select("file_link")
          .eq("project_id", projectId);

        if (fileRows && fileRows.length > 0) {
          // Match by original filename (file_link ends with _<filename>)
          const match = fileRows.find((row: any) => {
            const link = row.file_link as string;
            const fileName = link.split("/").pop() ?? "";
            const cleanName = fileName.replace(/^\d+_/, "");
            return cleanName === requestedFilename;
          });
          if (match) {
            storagePath = match.file_link;
          }
        }
      }

      if (!storagePath) {
        res.status(404).json({
          error:
            "File not found. It may not have been uploaded to storage yet.",
        });
        return;
      }
      const blob = await downloadFile(storagePath);

      // Convert Blob to Buffer
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine content type from the storage path or file entry
      const ext = storagePath.split(".").pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        zip: "application/zip",
      };
      const contentType = contentTypes[ext ?? ""] ?? "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(requestedFilename)}"`,
      );
      res.setHeader("Content-Length", buffer.length.toString());
      res.send(buffer);
    } catch (err) {
      console.error("[GET /projects/:id/files/:filename] error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Download failed.",
      });
    }
  },
);

export default projectsRouter;
