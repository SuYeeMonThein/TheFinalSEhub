import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import {
  AuthedRequest,
  requireCoordinator,
  verifyFirebaseAuth,
} from "../middleware/auth";
import {
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  listUsers,
  updateUserRecord,
  UserRecord,
  UserRole,
} from "../services/userService";
import { adminAuth } from "../config/firebase";
import { getSupabaseAdminClient } from "../services/supabaseClient";
import { sendWelcomeEmail } from "../services/emailService";
import { upsertRosterEntries } from "../services/rosterService";

const usersRouter = Router();

const ASSIGNABLE_ROLES: UserRole[] = ["student", "advisor", "coordinator"];

const isMissingUserRolesTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message =
    "message" in error
      ? String(error.message ?? "").toLowerCase()
      : "";

  return code === "42P01" || message.includes("user_roles");
};

const selectPrimaryRole = (roles: UserRole[]): UserRole => {
  if (roles.includes("coordinator")) {
    return "coordinator";
  }

  if (roles.includes("advisor")) {
    return "advisor";
  }

  return "student";
};

const listAssignedRoles = async (
  userId: number,
  fallbackRole: UserRole,
): Promise<{ roles: UserRole[]; error?: string }> => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    if (isMissingUserRolesTableError(error)) {
      return { roles: [fallbackRole] };
    }

    return { roles: [fallbackRole], error: error.message };
  }

  const parsedRoles = Array.from(
    new Set(
      (data ?? [])
        .map((entry) => parseAssignableRole(entry.role))
        .filter((role): role is UserRole => Boolean(role)),
    ),
  );

  return { roles: parsedRoles.length > 0 ? parsedRoles : [fallbackRole] };
};

const replaceAssignedRoles = async (
  userId: number,
  roles: UserRole[],
): Promise<{ error?: string }> => {
  const supabase = getSupabaseAdminClient();

  const deleteResult = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId);

  if (deleteResult.error) {
    if (isMissingUserRolesTableError(deleteResult.error)) {
      return {};
    }

    return { error: deleteResult.error.message };
  }

  if (roles.length === 0) {
    return {};
  }

  const insertRows = roles.map((role) => ({ user_id: userId, role }));
  const insertResult = await supabase.from("user_roles").insert(insertRows);

  if (insertResult.error) {
    if (isMissingUserRolesTableError(insertResult.error)) {
      return {};
    }

    return { error: insertResult.error.message };
  }

  return {};
};

const extractAuthErrorCode = (error: unknown): string | undefined => {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code?: unknown };
    return typeof code === "string" ? code : undefined;
  }

  return undefined;
};

const parseAssignableRole = (value: unknown): UserRole | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedRole = value.trim() as UserRole;

  return ASSIGNABLE_ROLES.includes(trimmedRole) ? trimmedRole : undefined;
};

const sanitizeUser = (record: UserRecord | null | undefined) => {
  if (!record) {
    return null;
  }

  const { password: _password, ...rest } = record;
  return rest;
};

const deriveStudentIdentifier = (record: UserRecord): string => {
  const localPart = record.email.split("@")[0]?.trim();

  if (localPart && /^[A-Za-z0-9._-]{3,64}$/.test(localPart)) {
    return localPart;
  }

  return String(record.id);
};

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Create a new platform user. Coordinator-only.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [student, advisor]
 *     responses:
 *       '201':
 *         description: User created successfully.
 *       '400':
 *         description: Invalid payload supplied.
 *       '401':
 *         description: Missing or invalid token.
 *       '403':
 *         description: Caller is not a coordinator.
 *       '409':
 *         description: Email already exists.
 */
usersRouter.post(
  "/",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const { name, email, password, role } = req.body ?? {};
    const parsedRole = parseAssignableRole(role);

    if (!name || !email || !password || !role) {
      res.status(400).json({
        error: "Missing required fields: name, email, password, role.",
      });
      return;
    }

    if (!parsedRole) {
      res.status(400).json({
        error: "Invalid role. Allowed roles: student, advisor, coordinator.",
      });
      return;
    }

    let firebaseUid: string | null = null;

    try {
      const firebaseUser = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });

      firebaseUid = firebaseUser.uid;

      await adminAuth.setCustomUserClaims(firebaseUser.uid, {
        role: parsedRole,
      });
    } catch (error) {
      const code = extractAuthErrorCode(error);

      if (code === "auth/email-already-exists") {
        res.status(409).json({ error: "Email address already in use." });
        return;
      }

      res
        .status(500)
        .json({ error: "Failed to create authentication record." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data, error } = await createUser({
      name,
      email,
      passwordHash,
      role: parsedRole,
    });

    if (error) {
      if (firebaseUid) {
        await adminAuth.deleteUser(firebaseUid).catch(() => undefined);
      }

      if ("code" in error && error.code === "23505") {
        res.status(409).json({ error: "Email address already in use." });
        return;
      }

      res.status(500).json({ error: error.message });
      return;
    }

    if (data) {
      const syncRolesResult = await replaceAssignedRoles(data.id, [parsedRole]);
      if (syncRolesResult.error) {
        // eslint-disable-next-line no-console
        console.warn(
          "Failed to sync user_roles after create:",
          syncRolesResult.error,
        );
      }
    }

    // Send welcome email via Resend (non-blocking – don't fail the request)
    sendWelcomeEmail({ name, email, password, role: parsedRole }).catch((err) =>
      console.error("Welcome email error:", err),
    );

    res.status(201).json({ user: sanitizeUser(data) });
  },
);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Retrieve users (optionally filter by email). Coordinator-only.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: Filter to a single user by email address.
 *     responses:
 *       '200':
 *         description: Users retrieved successfully.
 *       '401':
 *         description: Missing or invalid token.
 *       '403':
 *         description: Caller is not a coordinator.
 *       '404':
 *         description: User with the specified email was not found.
 */
usersRouter.get(
  "/me/roles",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const emailFromToken = req.user?.email;

    if (!emailFromToken) {
      res
        .status(400)
        .json({ error: "Email address missing from authentication token." });
      return;
    }

    const existingResponse = await findUserByEmail(emailFromToken);

    if (existingResponse.error) {
      res.status(500).json({ error: existingResponse.error.message });
      return;
    }

    const existingUser = existingResponse.data;

    if (!existingUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const rolesResponse = await listAssignedRoles(existingUser.id, existingUser.role);

    if (rolesResponse.error) {
      res.status(500).json({ error: rolesResponse.error });
      return;
    }

    res.json({ roles: rolesResponse.roles });
  },
);

usersRouter.get(
  "/",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const { email } = req.query;

    if (typeof email === "string" && email.trim().length > 0) {
      const { data, error } = await findUserByEmail(email.trim());

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      res.json({ user: sanitizeUser(data) });
      return;
    }

    const { data, error } = await listUsers();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ users: (data ?? []).map((record) => sanitizeUser(record)) });
  },
);

usersRouter.patch(
  "/:id",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      res.status(400).json({ error: "Invalid user identifier." });
      return;
    }

    const { name, email, password, role } = req.body ?? {};

    if (!name && !email && !password && !role) {
      res.status(400).json({ error: "No updates supplied." });
      return;
    }

    const parsedRole = parseAssignableRole(role);

    if (role && !parsedRole) {
      res.status(400).json({ error: "Invalid role provided." });
      return;
    }

    const existingResponse = await findUserById(numericId);

    if (existingResponse.error) {
      res.status(500).json({ error: existingResponse.error.message });
      return;
    }

    const existingUser = existingResponse.data;

    if (!existingUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    let firebaseUid: string;

    try {
      const firebaseUser = await adminAuth.getUserByEmail(existingUser.email);
      firebaseUid = firebaseUser.uid;
    } catch (error) {
      const code = extractAuthErrorCode(error);

      if (code === "auth/user-not-found") {
        res
          .status(409)
          .json({ error: "Authentication record not found for this user." });
        return;
      }

      res.status(500).json({ error: "Failed to load authentication record." });
      return;
    }

    const updatePayload: {
      name?: string;
      email?: string;
      passwordHash?: string;
      role?: UserRole;
    } = {};

    if (
      typeof name === "string" &&
      name.trim().length > 0 &&
      name.trim() !== existingUser.name
    ) {
      updatePayload.name = name.trim();
    }

    if (
      typeof email === "string" &&
      email.trim().length > 0 &&
      email.trim() !== existingUser.email
    ) {
      updatePayload.email = email.trim();
    }

    if (typeof password === "string" && password.trim().length > 0) {
      updatePayload.passwordHash = await bcrypt.hash(password, 12);
    }

    if (parsedRole && parsedRole !== existingUser.role) {
      updatePayload.role = parsedRole;
    }

    if (Object.keys(updatePayload).length === 0) {
      res.json({ user: sanitizeUser(existingUser) });
      return;
    }

    const updateResult = await updateUserRecord(numericId, updatePayload);

    if (updateResult.error) {
      if ("code" in updateResult.error && updateResult.error.code === "23505") {
        res.status(409).json({ error: "Email address already in use." });
        return;
      }

      res.status(500).json({ error: updateResult.error.message });
      return;
    }

    const updatedUser = updateResult.data;

    if (updatePayload.role) {
      const syncRolesResult = await replaceAssignedRoles(numericId, [updatePayload.role]);
      if (syncRolesResult.error) {
        // eslint-disable-next-line no-console
        console.warn(
          "Failed to sync user_roles after patch:",
          syncRolesResult.error,
        );
      }
    }

    try {
      const firebaseUpdatePayload: Record<string, string> = {};

      if (updatePayload.name) {
        firebaseUpdatePayload.displayName = updatePayload.name;
      }

      if (updatePayload.email) {
        firebaseUpdatePayload.email = updatePayload.email;
      }

      if (typeof password === "string" && password.trim().length > 0) {
        firebaseUpdatePayload.password = password.trim();
      }

      if (Object.keys(firebaseUpdatePayload).length > 0) {
        await adminAuth.updateUser(firebaseUid, firebaseUpdatePayload);
      }

      if (updatePayload.role) {
        await adminAuth.setCustomUserClaims(firebaseUid, {
          role: updatePayload.role,
        });
      }
    } catch (error) {
      await updateUserRecord(numericId, {
        name: existingUser.name,
        email: existingUser.email,
        passwordHash: existingUser.password,
        role: existingUser.role,
      }).catch(() => undefined);

      if (parsedRole && parsedRole !== existingUser.role) {
        await adminAuth
          .setCustomUserClaims(firebaseUid, { role: existingUser.role })
          .catch(() => undefined);
      }

      res.status(500).json({
        error:
          "Failed to synchronize authentication record. Changes have been reverted.",
      });
      return;
    }

    res.json({ user: sanitizeUser(updatedUser) });
  },
);

usersRouter.post(
  "/:id/course-assignments",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const numericId = Number(req.params.id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      res.status(400).json({ error: "Invalid user identifier." });
      return;
    }

    const rawCourseIds: unknown[] = Array.isArray(req.body?.courseIds)
      ? req.body.courseIds
      : [];

    const courseIds: number[] = Array.from(
      new Set(
        rawCourseIds
          .map((courseId): number => Number(courseId))
          .filter(
            (courseId: number): boolean =>
              Number.isInteger(courseId) && courseId > 0,
          ),
      ),
    );

    if (courseIds.length === 0) {
      res
        .status(400)
        .json({ error: "At least one valid courseId is required." });
      return;
    }

    const existingUserResponse = await findUserById(numericId);

    if (existingUserResponse.error) {
      res.status(500).json({ error: existingUserResponse.error.message });
      return;
    }

    const student = existingUserResponse.data;

    if (!student) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    if (student.role !== "student") {
      res.status(400).json({ error: "Only student users can be assigned." });
      return;
    }

    const supabase = getSupabaseAdminClient();

    const { data: existingCourses, error: courseLookupError } = await supabase
      .from("course")
      .select("id")
      .in("id", courseIds);

    if (courseLookupError) {
      res.status(500).json({ error: courseLookupError.message });
      return;
    }

    const existingCourseIds = new Set<number>(
      (existingCourses ?? []).map((c) => Number(c.id)),
    );
    const missingCourseIds = courseIds.filter(
      (courseId) => !existingCourseIds.has(courseId),
    );

    if (missingCourseIds.length > 0) {
      res.status(404).json({
        error: `Course not found for id(s): ${missingCourseIds.join(", ")}`,
      });
      return;
    }

    const derivedStudentId = deriveStudentIdentifier(student);

    for (const courseId of courseIds) {
      // Remove any previous row for this email in the same course to avoid
      // duplicates when one source used a different student_id.
      const cleanup = await supabase
        .from("course_roster")
        .delete()
        .eq("course_id", courseId)
        .eq("email", student.email)
        .neq("student_id", derivedStudentId);

      if (cleanup.error) {
        res.status(500).json({ error: cleanup.error.message });
        return;
      }

      const upsertResult = await upsertRosterEntries(courseId, [
        {
          studentId: derivedStudentId,
          name: student.name,
          email: student.email,
        },
      ]);

      if (upsertResult.error) {
        res.status(500).json({ error: upsertResult.error.message });
        return;
      }
    }

    res.status(201).json({
      success: true,
      assignedCourseIds: courseIds,
    });
  },
);

usersRouter.get(
  "/:id/roles",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const numericId = Number(req.params.id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      res.status(400).json({ error: "Invalid user identifier." });
      return;
    }

    const existingResponse = await findUserById(numericId);

    if (existingResponse.error) {
      res.status(500).json({ error: existingResponse.error.message });
      return;
    }

    const existingUser = existingResponse.data;

    if (!existingUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const rolesResponse = await listAssignedRoles(numericId, existingUser.role);

    if (rolesResponse.error) {
      res.status(500).json({ error: rolesResponse.error });
      return;
    }

    res.json({ roles: rolesResponse.roles });
  },
);

usersRouter.put(
  "/:id/roles",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const numericId = Number(req.params.id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      res.status(400).json({ error: "Invalid user identifier." });
      return;
    }

    const rawRoles: unknown[] = Array.isArray(req.body?.roles)
      ? req.body.roles
      : [];

    const parsedRoles = Array.from(
      new Set(
        rawRoles
          .map((role) => parseAssignableRole(role))
          .filter((role): role is UserRole => Boolean(role)),
      ),
    );

    if (parsedRoles.length === 0) {
      res.status(400).json({
        error: "At least one valid role is required.",
      });
      return;
    }

    const existingResponse = await findUserById(numericId);

    if (existingResponse.error) {
      res.status(500).json({ error: existingResponse.error.message });
      return;
    }

    const existingUser = existingResponse.data;

    if (!existingUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const syncRolesResult = await replaceAssignedRoles(numericId, parsedRoles);

    if (syncRolesResult.error) {
      res.status(500).json({ error: syncRolesResult.error });
      return;
    }

    const primaryRole = selectPrimaryRole(parsedRoles);

    if (existingUser.role !== primaryRole) {
      const updateResult = await updateUserRecord(numericId, {
        role: primaryRole,
      });

      if (updateResult.error) {
        res.status(500).json({ error: updateResult.error.message });
        return;
      }
    }

    try {
      const firebaseUser = await adminAuth.getUserByEmail(existingUser.email);
      await adminAuth.setCustomUserClaims(firebaseUser.uid, {
        role: primaryRole,
      });
    } catch (error) {
      const code = extractAuthErrorCode(error);

      if (code !== "auth/user-not-found") {
        res.status(500).json({ error: "Failed to update authentication claims." });
        return;
      }
    }

    res.json({
      userId: numericId,
      roles: parsedRoles,
      primaryRole,
    });
  },
);

usersRouter.delete(
  "/:id",
  verifyFirebaseAuth,
  requireCoordinator,
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      res.status(400).json({ error: "Invalid user identifier." });
      return;
    }

    const existingResponse = await findUserById(numericId);

    if (existingResponse.error) {
      res.status(500).json({ error: existingResponse.error.message });
      return;
    }

    const existingUser = existingResponse.data;

    if (!existingUser) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const supabase = getSupabaseAdminClient();

    if (existingUser.role === "student") {
      const teamCleanup = await supabase
        .from("team_member")
        .delete()
        .eq("student_id", numericId);

      if (teamCleanup.error) {
        res.status(500).json({ error: teamCleanup.error.message });
        return;
      }
    }

    if (existingUser.role === "advisor") {
      const projectCleanup = await supabase
        .from("project")
        .update({ advisor_id: null })
        .eq("advisor_id", numericId);

      if (projectCleanup.error) {
        res.status(500).json({ error: projectCleanup.error.message });
        return;
      }

      const courseCleanup = await supabase
        .from("course")
        .update({ advisor_id: null })
        .eq("advisor_id", numericId);

      if (courseCleanup.error) {
        res.status(500).json({ error: courseCleanup.error.message });
        return;
      }
    }

    const deleteResult = await deleteUserById(numericId);

    if (deleteResult.error) {
      res.status(500).json({ error: deleteResult.error.message });
      return;
    }

    try {
      const firebaseUser = await adminAuth.getUserByEmail(existingUser.email);
      await adminAuth.deleteUser(firebaseUser.uid);
    } catch (error) {
      const code = extractAuthErrorCode(error);

      if (code !== "auth/user-not-found") {
        // eslint-disable-next-line no-console
        console.warn(
          "Failed to remove Firebase user for deleted account",
          error,
        );
      }
    }

    res.status(204).send();
  },
);

export default usersRouter;
