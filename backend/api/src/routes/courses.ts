import { Router, Response } from "express";
import { AuthedRequest, verifyFirebaseAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createCourseSchema } from "../middleware/schemas";
import { getSupabaseAdminClient } from "../services/supabaseClient";
import { findUserByEmail, findUserById } from "../services/userService";
import {
  listProjectsByCourse,
  ProjectWithRelations,
  ProjectMetadata,
  ProjectType,
  ProjectStatus,
} from "../services/projectService";
import {
  listRosterByCourse,
  upsertRosterEntries,
  deleteRosterEntry,
  UpsertRosterInput,
} from "../services/rosterService";

const coursesRouter = Router();

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

const ensureRosterAccess = async (
  req: AuthedRequest,
  res: Response,
  courseId: number,
): Promise<boolean> => {
  const role = req.user?.role;

  if (role === "coordinator") {
    return true;
  }

  if (role !== "advisor") {
    res.status(403).json({
      error: "Only coordinators or assigned advisors can access course rosters.",
    });
    return false;
  }

  const emailFromToken = req.user?.email;

  if (!emailFromToken) {
    res
      .status(400)
      .json({ error: "Email address missing from authentication token." });
    return false;
  }

  const advisorResponse = await findUserByEmail(emailFromToken);

  if (advisorResponse.error) {
    res.status(500).json({ error: advisorResponse.error.message });
    return false;
  }

  if (!advisorResponse.data) {
    res.status(404).json({ error: "User not found." });
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data: course, error: courseError } = await supabase
    .from("course")
    .select("id, advisor_id")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) {
    res.status(500).json({ error: courseError.message });
    return false;
  }

  if (!course) {
    res.status(404).json({ error: "Course not found." });
    return false;
  }

  if (course.advisor_id !== advisorResponse.data.id) {
    res.status(403).json({
      error: "Advisors can only access rosters for their assigned courses.",
    });
    return false;
  }

  return true;
};

// Helper to format project data - matching the format from projects route
const formatProjectForCourse = (record: ProjectWithRelations) => {
  const { project, advisor, students, metadata, links } = record;

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
  const files = Array.isArray(parsedMetadata.files)
    ? parsedMetadata.files.filter(
        (file) => typeof file === "object" && file !== null,
      )
    : [];
  const metadataGrade =
    typeof parsedMetadata.grade === "string" ? parsedMetadata.grade : null;

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
    feedback: {
      advisor: project.feedback_advisor,
      coordinator: project.feedback_coordinator,
    },
  };
};

// Create a new course (coordinator only)
coursesRouter.post(
  "/",
  verifyFirebaseAuth,
  validate(createCourseSchema),
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;

    if (role !== "coordinator") {
      res.status(403).json({ error: "Only coordinators can create courses." });
      return;
    }

    const {
      courseCode,
      title,
      description,
      semester,
      year,
      credits,
      instructor,
      advisorEmail,
    } = req.body;

    const supabase = getSupabaseAdminClient();

    const normalizedAdvisorEmail =
      typeof advisorEmail === "string" ? advisorEmail.trim() : "";
    let advisorId: number | null = null;
    let resolvedAdvisorName = "";
    let resolvedAdvisorEmail = "";

    if (normalizedAdvisorEmail.length > 0) {
      const advisorResponse = await findUserByEmail(normalizedAdvisorEmail);

      if (advisorResponse.error || !advisorResponse.data) {
        res
          .status(404)
          .json({ error: "Advisor not found with the provided email." });
        return;
      }

      advisorId = advisorResponse.data.id;
      resolvedAdvisorName = advisorResponse.data.name;
      resolvedAdvisorEmail = advisorResponse.data.email;
    }

    // Insert course
    const { data: course, error } = await supabase
      .from("course")
      .insert({
        course_code: courseCode,
        semester: semester,
        year: parseInt(year),
        credit: credits.toString(),
        advisor_id: advisorId,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({
      course: {
        id: course.id,
        courseCode: course.course_code,
        title: title,
        description: description || "",
        semester: course.semester,
        year: course.year.toString(),
        credits: parseInt(course.credit),
        instructor: resolvedAdvisorName || instructor || "",
        advisorEmail: resolvedAdvisorEmail,
        advisorId: course.advisor_id,
        advisorName: resolvedAdvisorName,
      },
    });
  },
);

// Get all courses for coordinator, or assigned courses for advisor
coursesRouter.get(
  "/",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const emailFromToken = req.user?.email;

    if (!emailFromToken) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const userResponse = await findUserByEmail(emailFromToken);

    if (userResponse.error || !userResponse.data) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const user = userResponse.data;
    const role = req.user?.role ?? user.role;
    const supabase = getSupabaseAdminClient();

    let coursesQuery = supabase.from("course").select(`
    *,
    advisor:user!course_advisor_id_fkey(id, name, email)
  `);

    // Filter by advisor if user is an advisor
    if (role === "advisor") {
      coursesQuery = coursesQuery.eq("advisor_id", user.id);
    }

    const { data: courses, error } = await coursesQuery.order("year", {
      ascending: false,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const formattedCourses =
      courses?.map((course) => ({
        id: course.id.toString(),
        courseCode: course.course_code,
        semester: course.semester,
        year: course.year.toString(),
        credits: parseInt(course.credit),
        advisorEmail: course.advisor?.email || "",
        advisorId: course.advisor_id,
        advisorName: course.advisor?.name || "",
      })) || [];

    res.json({ courses: formattedCourses });
  },
);

// Update a course (coordinator only)
coursesRouter.put(
  "/:courseId",
  verifyFirebaseAuth,
  validate(createCourseSchema),
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;

    if (role !== "coordinator") {
      res.status(403).json({ error: "Only coordinators can update courses." });
      return;
    }

    const { courseId } = req.params;
    const parsedCourseId = parseInt(courseId);

    if (Number.isNaN(parsedCourseId)) {
      res.status(400).json({ error: "Invalid courseId." });
      return;
    }

    const {
      courseCode,
      title,
      description,
      semester,
      year,
      credits,
      instructor,
      advisorEmail,
    } = req.body;

    const supabase = getSupabaseAdminClient();

    const { data: existingCourse, error: existingCourseError } = await supabase
      .from("course")
      .select("id, advisor_id")
      .eq("id", parsedCourseId)
      .maybeSingle();

    if (existingCourseError) {
      res.status(500).json({ error: existingCourseError.message });
      return;
    }

    if (!existingCourse) {
      res.status(404).json({ error: "Course not found." });
      return;
    }

    let nextAdvisorId = existingCourse.advisor_id;
    let resolvedAdvisorName = "";
    let resolvedAdvisorEmail = "";

    if (typeof advisorEmail === "string" && advisorEmail.trim().length > 0) {
      const advisorResponse = await findUserByEmail(advisorEmail.trim());
      if (advisorResponse.error) {
        res.status(500).json({ error: advisorResponse.error.message });
        return;
      }

      if (!advisorResponse.data) {
        res
          .status(404)
          .json({ error: "User not found with the provided email." });
        return;
      }

      nextAdvisorId = advisorResponse.data.id;
      resolvedAdvisorName = advisorResponse.data.name;
      resolvedAdvisorEmail = advisorResponse.data.email;
    } else {
      const existingAdvisorResponse = await findUserById(
        existingCourse.advisor_id,
      );
      if (existingAdvisorResponse.error) {
        res.status(500).json({ error: existingAdvisorResponse.error.message });
        return;
      }

      if (existingAdvisorResponse.data) {
        resolvedAdvisorName = existingAdvisorResponse.data.name;
        resolvedAdvisorEmail = existingAdvisorResponse.data.email;
      }
    }

    const { data: course, error } = await supabase
      .from("course")
      .update({
        course_code: courseCode,
        semester,
        year: parseInt(year),
        credit: credits.toString(),
        advisor_id: nextAdvisorId,
      })
      .eq("id", parsedCourseId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({
      course: {
        id: course.id,
        courseCode: course.course_code,
        title,
        description: description || "",
        semester: course.semester,
        year: course.year.toString(),
        credits: parseInt(course.credit),
        instructor,
        advisorEmail: resolvedAdvisorEmail,
        advisorId: course.advisor_id,
        advisorName: resolvedAdvisorName,
      },
    });
  },
);

// Delete a course (coordinator only)
coursesRouter.delete(
  "/:courseId",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const role = req.user?.role;

    if (role !== "coordinator") {
      res.status(403).json({ error: "Only coordinators can delete courses." });
      return;
    }

    const { courseId } = req.params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("course")
      .delete()
      .eq("id", parseInt(courseId));

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: "Course deleted successfully." });
  },
);

// Get projects for a specific course
coursesRouter.get(
  "/:courseId/projects",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const { courseId } = req.params;

    const projectsResult = await listProjectsByCourse(parseInt(courseId));

    if (projectsResult.error) {
      res.status(500).json({ error: projectsResult.error.message });
      return;
    }

    const formattedProjects = (projectsResult.data || []).map(
      formatProjectForCourse,
    );

    res.json({ projects: formattedProjects });
  },
);

export default coursesRouter;

// --- Roster endpoints ---

// Get roster for a course
coursesRouter.get(
  "/:courseId/roster",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const { courseId } = req.params;
    const parsedCourseId = parseInt(courseId);

    if (Number.isNaN(parsedCourseId)) {
      res.status(400).json({ error: "Invalid courseId" });
      return;
    }

    if (!(await ensureRosterAccess(req, res, parsedCourseId))) {
      return;
    }

    const result = await listRosterByCourse(parsedCourseId);
    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json({ roster: result.data ?? [] });
  },
);

// Upsert roster entries for a course
coursesRouter.post(
  "/:courseId/roster",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const { courseId } = req.params;
    const parsedCourseId = parseInt(courseId);
    if (Number.isNaN(parsedCourseId)) {
      res.status(400).json({ error: "Invalid courseId" });
      return;
    }

    if (!(await ensureRosterAccess(req, res, parsedCourseId))) {
      return;
    }

    const students: UpsertRosterInput[] = Array.isArray(req.body?.students)
      ? req.body.students
      : [];
    const sanitized: UpsertRosterInput[] = students
      .map((s: UpsertRosterInput) => ({
        studentId:
          typeof s.studentId === "string"
            ? s.studentId
            : String(s.studentId ?? ""),
        name: typeof s.name === "string" ? s.name : "",
        email: typeof s.email === "string" ? s.email : "",
        year: typeof s.year === "string" ? s.year : String(s.year ?? ""),
      }))
      .filter((s) => s.studentId && s.name && s.email);

    if (sanitized.length === 0) {
      res.status(400).json({ error: "No valid students provided." });
      return;
    }

    const result = await upsertRosterEntries(parsedCourseId, sanitized);
    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.status(201).json({
      roster: result.data ?? [],
      addedStudentIds: result.addedStudentIds ?? [],
    });
  },
);

// Delete a single roster entry for a course
coursesRouter.delete(
  "/:courseId/roster/:studentId",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const { courseId, studentId } = req.params;
    const parsedCourseId = parseInt(courseId);
    if (Number.isNaN(parsedCourseId)) {
      res.status(400).json({ error: "Invalid courseId" });
      return;
    }

    if (!(await ensureRosterAccess(req, res, parsedCourseId))) {
      return;
    }

    const result = await deleteRosterEntry(parsedCourseId, studentId);
    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json({ success: true });
  },
);
