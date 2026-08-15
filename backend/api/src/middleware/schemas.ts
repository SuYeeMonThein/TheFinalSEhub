import { z } from "zod";

// ── Course schemas ───────────────────────────────────────────────────────

export const createCourseSchema = z.object({
  courseCode: z.string().min(1, "courseCode is required").trim(),
  title: z.string().min(1, "title is required").trim(),
  description: z.string().optional().default(""),
  semester: z.string().min(1, "semester is required").trim(),
  year: z.union([z.string(), z.number()]).transform((v) => String(v)),
  credits: z.union([z.string(), z.number()]).transform((v) => String(v)),
  instructor: z.string().trim().optional().default(""),
  advisorEmail: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value.length === 0 ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "advisorEmail must be a valid email",
    )
    .default(""),
});

// ── Profile schemas ──────────────────────────────────────────────────────

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/`~]).{8,}$/;

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(
      passwordRegex,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
    ),
});

// ── Project schemas ──────────────────────────────────────────────────────

const teamMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export const createProjectSchema = z.object({
  title: z.string().min(1, "title is required"),
  description: z.string().min(1, "description is required"),
  type: z.string().optional(),
  keywords: z.union([z.array(z.string()), z.string()]).optional(),
  teamName: z.string().optional(),
  status: z.string().optional(),
  semester: z.string().optional(),
  competitionName: z.string().optional(),
  award: z.string().optional(),
  externalLinks: z.union([z.array(z.string()), z.string()]).optional(),
  teamMembers: z.union([z.array(teamMemberSchema), z.string()]).optional(),
  courseCode: z.string().optional(),
  completionDate: z.string().optional(),
  files: z.any().optional(),
});

export const updateGradeSchema = z.object({
  grade: z
    .string()
    .min(1, "grade is required")
    .transform((v) => v.trim().toUpperCase()),
});

export const updateFeedbackSchema = z.object({
  feedback: z.string().default(""),
});

export const updateStatusSchema = z.object({
  status: z.string().min(1, "status is required"),
});

// ── Comment schemas ──────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment content is required."),
  parentId: z.number().optional().nullable(),
});

// ── Student schemas ──────────────────────────────────────────────────────

export const rosterEntrySchema = z.object({
  studentId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});

export const bulkUploadStudentsSchema = z.object({
  students: z
    .array(rosterEntrySchema)
    .min(1, "At least one student is required."),
  courseId: z.number(),
});
