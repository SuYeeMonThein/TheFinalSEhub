import { Router, Response } from "express";
import {
  AuthedRequest,
  verifyFirebaseAuth,
  requireAdvisor,
} from "../middleware/auth";
import {
  listRubrics,
  getRubricById,
  createRubric,
  updateRubric,
  deleteRubric,
  toggleRubricStatus,
  setRubricCourses,
  TABLE_NOT_FOUND_CODE,
} from "../services/rubricService";
import { getSupabaseAdminClient } from "../services/supabaseClient";
import { findUserByEmail } from "../services/userService";

const rubricsRouter = Router();

// All rubric routes require authentication
rubricsRouter.use(verifyFirebaseAuth);

/** Return 503 when the rubric tables have not been created yet. */
const handleServiceResult = (
  res: Response,
  result: { error: string | null; code?: string },
  successStatus = 200,
  successBody?: unknown,
) => {
  if (result.error) {
    if (result.code === TABLE_NOT_FOUND_CODE) {
      res.status(503).json({
        error:
          "Rubric tables have not been created yet. Please run the database migration.",
        code: "setup_required",
      });
      return true;
    }
    res.status(500).json({ error: result.error });
    return true;
  }
  return false;
};

// GET /rubrics — list all rubrics
rubricsRouter.get("/", async (_req: AuthedRequest, res: Response) => {
  const result = await listRubrics();
  if (handleServiceResult(res, result)) return;
  res.json({ rubrics: result.data });
});

// GET /rubrics/:id — get single rubric
rubricsRouter.get("/:id", async (req: AuthedRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid rubric ID." });
    return;
  }

  const result = await getRubricById(id);
  if (handleServiceResult(res, result)) return;
  res.json({ rubric: result.data });
});

// POST /rubrics — create a new rubric (advisor only)
rubricsRouter.post(
  "/",
  requireAdvisor,
  async (req: AuthedRequest, res: Response) => {
    const { name, description, projectTypes, criteria, maxPoints } = req.body;

    if (
      !name ||
      !criteria ||
      !Array.isArray(criteria) ||
      criteria.length === 0
    ) {
      res
        .status(400)
        .json({ error: "Name and at least one criterion are required." });
      return;
    }

    const createdBy = req.user?.email ?? "unknown";

    const result = await createRubric({
      name,
      description,
      projectTypes: projectTypes ?? [],
      criteria,
      maxPoints,
      createdBy,
    });

    if (handleServiceResult(res, result)) return;
    res.status(201).json({ rubric: result.data });
  },
);

// PUT /rubrics/:id — update a rubric (advisor only)
rubricsRouter.put(
  "/:id",
  requireAdvisor,
  async (req: AuthedRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid rubric ID." });
      return;
    }

    const { name, description, projectTypes, criteria, maxPoints, isActive } =
      req.body;

    const result = await updateRubric(id, {
      name,
      description,
      projectTypes,
      criteria,
      maxPoints,
      isActive,
    });
    if (handleServiceResult(res, result)) return;
    res.json({ rubric: result.data });
  },
);

// PATCH /rubrics/:id/toggle — toggle active status (advisor only)
rubricsRouter.patch(
  "/:id/toggle",
  requireAdvisor,
  async (req: AuthedRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid rubric ID." });
      return;
    }

    const result = await toggleRubricStatus(id);
    if (handleServiceResult(res, result)) return;
    res.json({ rubric: result.data });
  },
);

// PUT /rubrics/:id/courses — set which courses use this rubric (advisor only).
// Coordinators can assign to any course; advisors only to courses they advise.
rubricsRouter.put(
  "/:id/courses",
  requireAdvisor,
  async (req: AuthedRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid rubric ID." });
      return;
    }

    const rawCourseIds: unknown = req.body?.courseIds;
    const courseIds = Array.isArray(rawCourseIds)
      ? rawCourseIds.map((value) => Number(value))
      : null;

    if (
      !courseIds ||
      courseIds.some((value) => !Number.isInteger(value) || value <= 0)
    ) {
      res
        .status(400)
        .json({ error: "courseIds must be an array of course IDs." });
      return;
    }

    let scopeCourseIds: number[] | null = null;
    const role = req.actingRole ?? req.user?.role;

    if (role !== "coordinator") {
      const email = req.user?.email;
      const userResponse = email ? await findUserByEmail(email) : null;

      if (!userResponse || userResponse.error || !userResponse.data) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      const { data: ownCourses, error: courseErr } =
        await getSupabaseAdminClient()
          .from("course")
          .select("id")
          .eq("advisor_id", userResponse.data.id);

      if (courseErr) {
        res.status(500).json({ error: courseErr.message });
        return;
      }

      scopeCourseIds = (ownCourses ?? []).map((course) => course.id as number);
    }

    const result = await setRubricCourses(
      id,
      Array.from(new Set(courseIds)),
      scopeCourseIds,
    );

    if (result.error !== null && result.code === "forbidden") {
      res.status(403).json({ error: result.error });
      return;
    }
    if (result.error !== null && result.code === "not_found") {
      res.status(404).json({ error: result.error });
      return;
    }
    if (result.error !== null && result.code === TABLE_NOT_FOUND_CODE) {
      res.status(503).json({
        error:
          "The rubric_course table has not been created yet. Run backend/database/migrations/20261015_add_rubric_course.sql.",
        code: "setup_required",
      });
      return;
    }
    if (handleServiceResult(res, result)) return;
    res.json({ rubric: result.data });
  },
);

// DELETE /rubrics/:id — delete a rubric (advisor only)
rubricsRouter.delete(
  "/:id",
  requireAdvisor,
  async (req: AuthedRequest, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid rubric ID." });
      return;
    }

    const result = await deleteRubric(id);
    if (handleServiceResult(res, result)) return;
    res.json({ message: "Rubric deleted successfully." });
  },
);

export default rubricsRouter;
