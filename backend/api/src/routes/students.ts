import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import {
  AuthedRequest,
  requireCoordinator,
  verifyFirebaseAuth,
} from "../middleware/auth";
import { getSupabaseAdminClient } from "../services/supabaseClient";
import { sendBulkWelcomeEmails } from "../services/emailService";
import { adminAuth } from "../config/firebase";
import { createUser, findUserByEmail } from "../services/userService";

const studentsRouter = Router();

interface StudentUpload {
  name: string;
  email: string;
  rollNumber: string;
  year?: string;
  department?: string;
  section?: string;
}

/**
 * @openapi
 * /students/bulk-upload:
 *   post:
 *     summary: Bulk upload students from CSV and send sign-in links
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - students
 *             properties:
 *               students:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     rollNumber:
 *                       type: string
 *                     year:
 *                       type: string
 *                     department:
 *                       type: string
 *                     section:
 *                       type: string
 *               sendEmails:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       '201':
 *         description: Students uploaded successfully
 *       '400':
 *         description: Invalid request body
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - requires coordinator role
 */
studentsRouter.post(
  "/bulk-upload",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { students, sendEmails = true } = req.body ?? {};

      if (!Array.isArray(students) || students.length === 0) {
        res
          .status(400)
          .json({ error: "Students array is required and must not be empty" });
        return;
      }

      // Validate student data
      const validStudents: StudentUpload[] = [];
      const validationErrors: string[] = [];

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        if (!student.name || !student.email || !student.rollNumber) {
          validationErrors.push(
            `Row ${i + 1}: Missing required fields (name, email, rollNumber)`,
          );
          continue;
        }

        // Basic email validation
        if (!student.email.includes("@")) {
          validationErrors.push(`Row ${i + 1}: Invalid email format`);
          continue;
        }

        validStudents.push({
          name: student.name.trim(),
          email: student.email.trim().toLowerCase(),
          rollNumber: student.rollNumber.trim(),
          year: student.year?.trim(),
          department: student.department?.trim(),
          section: student.section?.trim(),
        });
      }

      if (validStudents.length === 0) {
        res.status(400).json({
          error: "No valid students to upload",
          validationErrors,
        });
        return;
      }

      const supabase = getSupabaseAdminClient();

      // Insert students into the tracking table
      const { data, error } = await supabase
        .from("students")
        .upsert(
          validStudents.map((s) => ({
            name: s.name,
            email: s.email,
            roll_number: s.rollNumber,
            year: s.year || null,
            department: s.department || null,
            section: s.section || null,
          })),
          { onConflict: "email" },
        )
        .select();

      if (error) {
        // eslint-disable-next-line no-console
        console.error("Supabase error:", error);
        res.status(500).json({ error: `Database error: ${error.message}` });
        return;
      }

      // Create Firebase auth accounts and Supabase user records for each student
      const defaultPassword = "Student@123";
      const passwordHash = await bcrypt.hash(defaultPassword, 12);

      for (const student of validStudents) {
        try {
          // Check if user already exists in the user table
          const existing = await findUserByEmail(student.email);
          if (existing.data) {
            continue; // Already has a user record, skip
          }

          // Create Firebase auth user (or get existing)
          let firebaseUid: string | null = null;
          try {
            const firebaseUser = await adminAuth.createUser({
              email: student.email,
              password: defaultPassword,
              displayName: student.name,
            });
            firebaseUid = firebaseUser.uid;
          } catch (fbError: unknown) {
            // If user already exists in Firebase, get their UID and update claims
            const code =
              typeof fbError === "object" &&
              fbError !== null &&
              "code" in fbError
                ? (fbError as { code?: string }).code
                : undefined;
            if (code === "auth/email-already-exists") {
              try {
                const existingUser = await adminAuth.getUserByEmail(
                  student.email,
                );
                firebaseUid = existingUser.uid;
                // Reset password to the default so Student@123 works after logout
                await adminAuth.updateUser(existingUser.uid, {
                  password: defaultPassword,
                });
              } catch {
                // eslint-disable-next-line no-console
                console.error(
                  `Could not find existing Firebase user for ${student.email}`,
                );
              }
            } else {
              // eslint-disable-next-line no-console
              console.error(
                `Firebase user creation failed for ${student.email}:`,
                fbError,
              );
            }
          }

          // Set student role custom claim
          if (firebaseUid) {
            await adminAuth
              .setCustomUserClaims(firebaseUid, { role: "student" })
              .catch(() => undefined);
          }

          // Create record in the user table
          await createUser({
            name: student.name,
            email: student.email,
            passwordHash,
            role: "student",
          });
        } catch (userError) {
          // eslint-disable-next-line no-console
          console.error(
            `Failed to create user record for ${student.email}:`,
            userError,
          );
        }
      }

      // Send welcome emails to students (same as manual user creation)
      let emailResults = { success: 0, failed: 0, errors: [] as string[] };

      if (sendEmails && validStudents.length > 0) {
        emailResults = await sendBulkWelcomeEmails(
          validStudents,
          defaultPassword,
        );
      }

      res.status(201).json({
        message: "Students uploaded successfully",
        studentsAdded: data?.length || validStudents.length,
        validationErrors:
          validationErrors.length > 0 ? validationErrors : undefined,
        emailResults: sendEmails ? emailResults : undefined,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Bulk upload error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * @openapi
 * /students:
 *   get:
 *     summary: List all students
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of students
 */
studentsRouter.get(
  "/",
  verifyFirebaseAuth,
  async (_req: AuthedRequest, res: Response) => {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ students: data });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("List students error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

/**
 * @openapi
 * /students/{id}/resend-invite:
 *   post:
 *     summary: Resend sign-in link to a student
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Invite resent successfully
 *       '404':
 *         description: Student not found
 */
studentsRouter.post(
  "/:id/resend-invite",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const supabase = getSupabaseAdminClient();

      const { data: student, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }

      const emailResults = await sendBulkWelcomeEmails(
        [
          {
            name: student.name,
            email: student.email,
            rollNumber: student.roll_number,
          },
        ],
        "Student@123",
      );

      res.json({
        message:
          emailResults.success > 0
            ? "Invite sent successfully"
            : "Failed to send invite",
        emailResults,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Resend invite error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default studentsRouter;
