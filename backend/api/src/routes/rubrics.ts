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
  TABLE_NOT_FOUND_CODE,
} from "../services/rubricService";

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
