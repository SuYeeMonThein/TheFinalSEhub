import { Router, Response } from "express";
import { AuthedRequest, verifyFirebaseAuth } from "../middleware/auth";
import { getSupabaseAdminClient } from "../services/supabaseClient";
import { findUserByEmail } from "../services/userService";

const commentsRouter = Router();

/**
 * @openapi
 * /comments/all:
 *   get:
 *     summary: Get all comments across all projects (for dashboard)
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of all comments with project information
 */
commentsRouter.get(
  "/all",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const supabase = getSupabaseAdminClient();

      // Get all comments
      const { data: comments, error } = await supabase
        .from("project_comment")
        .select("id, project_id, comment, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("[GET /comments/all] error:", error);
        res.status(500).json({ error: error.message });
        return;
      }

      // Get unique project IDs
      const projectIds = [...new Set(comments?.map((c) => c.project_id) || [])];
      const { data: projects } = await supabase
        .from("project")
        .select("id, title")
        .in("id", projectIds);

      // Get user details for each comment
      const userIds = [...new Set(comments?.map((c) => c.user_id) || [])];
      const { data: users } = await supabase
        .from("user")
        .select("id, name, email, role")
        .in("id", userIds);

      // Map projects and users by ID for quick lookup
      const projectMap = new Map(projects?.map((p) => [p.id, p]) || []);
      const userMap = new Map(users?.map((u) => [u.id, u]) || []);

      // Enrich comments with user and project details
      const enrichedComments =
        comments?.map((comment) => ({
          id: comment.id,
          project_id: comment.project_id,
          project_title:
            projectMap.get(comment.project_id)?.title || "Unknown Project",
          user_id: comment.user_id,
          user_name: userMap.get(comment.user_id)?.name || "Unknown User",
          user_email: userMap.get(comment.user_id)?.email || "",
          user_role: userMap.get(comment.user_id)?.role || "user",
          comment: comment.comment,
          created_at: comment.created_at,
        })) || [];

      res.json(enrichedComments);
    } catch (err) {
      console.error("[GET /comments/all] unhandled error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

/**
 * @openapi
 * /comments/{projectId}:
 *   get:
 *     summary: Get all comments for a project
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: List of comments
 */
commentsRouter.get(
  "/:projectId",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const numericProjectId = Number(projectId);

      if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
        res.status(400).json({ error: "Invalid project ID" });
        return;
      }

      const supabase = getSupabaseAdminClient();

      // Get comments with user information
      const { data: comments, error } = await supabase
        .from("project_comment")
        .select(
          `
          id,
          comment,
          created_at,
          updated_at,
          user:user_id (
            id,
            name,
            email,
            role
          )
        `,
        )
        .eq("project_id", numericProjectId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[GET /comments/:projectId] error:", error);
        res.status(500).json({ error: error.message });
        return;
      }

      res.json({ comments: comments || [] });
    } catch (err) {
      console.error("[GET /comments/:projectId] unhandled error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

/**
 * @openapi
 * /comments/{projectId}:
 *   post:
 *     summary: Add a comment to a project
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - comment
 *             properties:
 *               comment:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Comment created
 */
commentsRouter.post(
  "/:projectId",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const { comment } = req.body;
      const requesterEmail = req.user?.email;

      if (!requesterEmail) {
        res.status(400).json({ error: "Email missing from token" });
        return;
      }

      const numericProjectId = Number(projectId);
      if (!Number.isFinite(numericProjectId) || numericProjectId <= 0) {
        res.status(400).json({ error: "Invalid project ID" });
        return;
      }

      if (!comment || typeof comment !== "string" || !comment.trim()) {
        res.status(400).json({ error: "Comment text is required" });
        return;
      }

      // Get user ID
      const userResponse = await findUserByEmail(requesterEmail);
      if (userResponse.error || !userResponse.data) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = userResponse.data;
      const supabase = getSupabaseAdminClient();

      // Verify project exists
      const { data: project, error: projectError } = await supabase
        .from("project")
        .select("id")
        .eq("id", numericProjectId)
        .single();

      if (projectError || !project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Insert comment
      const { data: newComment, error: insertError } = await supabase
        .from("project_comment")
        .insert({
          project_id: numericProjectId,
          user_id: user.id,
          comment: comment.trim(),
        })
        .select(
          `
          id,
          comment,
          created_at,
          updated_at,
          user:user_id (
            id,
            name,
            email,
            role
          )
        `,
        )
        .single();

      if (insertError) {
        console.error("[POST /comments/:projectId] insert error:", insertError);
        res.status(500).json({ error: insertError.message });
        return;
      }

      res.status(201).json({ comment: newComment });
    } catch (err) {
      console.error("[POST /comments/:projectId] unhandled error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

/**
 * @openapi
 * /comments/{commentId}:
 *   delete:
 *     summary: Delete a comment
 *     tags:
 *       - Comments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Comment deleted
 */
commentsRouter.delete(
  "/:commentId",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { commentId } = req.params;
      const requesterEmail = req.user?.email;
      const role = req.user?.role;

      if (!requesterEmail) {
        res.status(400).json({ error: "Email missing from token" });
        return;
      }

      const numericCommentId = Number(commentId);
      if (!Number.isFinite(numericCommentId) || numericCommentId <= 0) {
        res.status(400).json({ error: "Invalid comment ID" });
        return;
      }

      // Get user ID
      const userResponse = await findUserByEmail(requesterEmail);
      if (userResponse.error || !userResponse.data) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const user = userResponse.data;
      const supabase = getSupabaseAdminClient();

      // Get comment to verify ownership
      const { data: comment, error: fetchError } = await supabase
        .from("project_comment")
        .select("user_id")
        .eq("id", numericCommentId)
        .single();

      if (fetchError || !comment) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }

      // Only allow user to delete their own comments, or coordinators can delete any
      if (comment.user_id !== user.id && role !== "coordinator") {
        res
          .status(403)
          .json({ error: "You can only delete your own comments" });
        return;
      }

      // Delete comment
      const { error: deleteError } = await supabase
        .from("project_comment")
        .delete()
        .eq("id", numericCommentId);

      if (deleteError) {
        console.error("[DELETE /comments/:commentId] error:", deleteError);
        res.status(500).json({ error: deleteError.message });
        return;
      }

      res.json({ message: "Comment deleted successfully" });
    } catch (err) {
      console.error("[DELETE /comments/:commentId] unhandled error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal server error",
      });
    }
  },
);

export default commentsRouter;
