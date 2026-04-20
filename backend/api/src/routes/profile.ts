import { Router, Response } from "express";
import { AuthedRequest, verifyFirebaseAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { changePasswordSchema } from "../middleware/schemas";
import { getSupabaseClient } from "../services/supabaseClient";
import { adminAuth } from "../config/firebase";

const profileRouter = Router();

type FirebaseLikeError = {
  code?: unknown;
  message?: unknown;
};

const getFirebaseErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const code = (error as FirebaseLikeError).code;
  return typeof code === "string" && code.length > 0 ? code : null;
};

const getFirebaseErrorMessage = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const message = (error as FirebaseLikeError).message;
  return typeof message === "string" && message.length > 0 ? message : null;
};

/**
 * @openapi
 * /profile:
 *   get:
 *     summary: Fetch the authenticated user's profile entry.
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Profile retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   nullable: true
 *       '401':
 *         description: Missing or invalid Firebase ID token.
 */
profileRouter.get(
  "/",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    const supabase = getSupabaseClient();
    const userId = req.user?.uid;

    if (!userId) {
      res.status(400).json({ error: "User ID missing in token." });
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ profile: data });
  },
);

/**
 * @openapi
 * /profile/change-password:
 *   post:
 *     summary: Change the authenticated user's password.
 *     tags:
 *       - Profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Password updated successfully.
 *       '400':
 *         description: Invalid request.
 *       '401':
 *         description: Unauthorized.
 */
profileRouter.post(
  "/change-password",
  verifyFirebaseAuth,
  validate(changePasswordSchema),
  async (req: AuthedRequest, res: Response) => {
    const uid = req.user?.uid;

    if (!uid) {
      res.status(400).json({ error: "User ID missing in token." });
      return;
    }

    const { newPassword } = req.body;

    try {
      await adminAuth.updateUser(uid, { password: newPassword });
      res.json({ message: "Password updated successfully." });
    } catch (error) {
      const errorCode = getFirebaseErrorCode(error);
      const errorMessage = getFirebaseErrorMessage(error);

      // eslint-disable-next-line no-console
      console.error("Password change error:", {
        code: errorCode,
        message: errorMessage,
      });

      res.status(500).json({
        error: errorCode
          ? `Failed to update password (${errorCode}).`
          : "Failed to update password. Please try again.",
      });
    }
  },
);

export default profileRouter;
