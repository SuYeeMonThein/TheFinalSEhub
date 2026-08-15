import { Router } from "express";
import { AuthedRequest, verifyFirebaseAuth } from "../middleware/auth";
import {
  getProjectMetrics,
  getSubmissionTrends,
  getProjectTypeDistribution,
  getApprovalRates,
  getStudentPerformance,
  getAdvisorPerformance,
  getCourseAnalytics,
  getImpactAnalysis,
  getDetailedProjects,
  AnalyticsFilters,
} from "../services/analyticsService";

const analyticsRouter = Router();

/**
 * @swagger
 * /analytics/metrics:
 *   get:
 *     summary: Get comprehensive project metrics
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Filter by year
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *         description: Filter by semester
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: integer
 *         description: Filter by course ID
 *     responses:
 *       200:
 *         description: Project metrics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - coordinators only
 */
analyticsRouter.get(
  "/metrics",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    try {
      if (req.user?.role !== "coordinator") {
        res.status(403).json({ error: "Coordinators only" });
        return;
      }

      const filters: AnalyticsFilters = {
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        semester: req.query.semester as "1" | "2" | "all" | undefined,
        courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
      };

      console.log("Fetching metrics with filters:", filters);
      const result = await getProjectMetrics(filters);

      if (result.error) {
        console.error("Analytics service error:", result.error);
        res.status(500).json({ error: result.error.message });
        return;
      }

      res.json(result.data);
    } catch (error) {
      console.error("Metrics endpoint error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  }
);

/**
 * @swagger
 * /analytics/trends:
 *   get:
 *     summary: Get submission trends over time
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: ["month", "semester", "year"]
 *         default: month
 *     responses:
 *       200:
 *         description: Submission trends
 */
analyticsRouter.get(
  "/trends",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
    };

    const groupBy = (req.query.groupBy as "month" | "semester" | "year") || "month";

    const result = await getSubmissionTrends(filters, groupBy);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/project-types:
 *   get:
 *     summary: Get project type distribution
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *     responses:
 *       200:
 *         description: Project type distribution
 */
analyticsRouter.get(
  "/project-types",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
    };

    const result = await getProjectTypeDistribution(filters);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/approval-rates:
 *   get:
 *     summary: Get approval rates by period
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Approval rates
 */
analyticsRouter.get(
  "/approval-rates",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
    };

    const result = await getApprovalRates(filters);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/students:
 *   get:
 *     summary: Get student performance analytics
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         default: 50
 *     responses:
 *       200:
 *         description: Student performance data
 */
analyticsRouter.get(
  "/students",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
    };

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const result = await getStudentPerformance(filters, limit);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/advisors:
 *   get:
 *     summary: Get advisor performance analytics
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *     responses:
 *       200:
 *         description: Advisor performance data
 */
analyticsRouter.get(
  "/advisors",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
    };

    const result = await getAdvisorPerformance(filters);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/courses:
 *   get:
 *     summary: Get course analytics
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *     responses:
 *       200:
 *         description: Course analytics data
 */
analyticsRouter.get(
  "/courses",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
    };

    const result = await getCourseAnalytics(filters);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/impact:
 *   get:
 *     summary: Get impact analysis
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *     responses:
 *       200:
 *         description: Impact analysis data
 */
analyticsRouter.get(
  "/impact",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
    };

    const result = await getImpactAnalysis(filters);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    res.json(result.data);
  }
);

/**
 * @swagger
 * /analytics/export:
 *   get:
 *     summary: Get detailed project list for export
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: semester
 *         schema:
 *           type: string
 *           enum: ["1", "2", "all"]
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: ["json", "csv"]
 *         default: json
 *     responses:
 *       200:
 *         description: Detailed project list
 */
analyticsRouter.get(
  "/export",
  verifyFirebaseAuth,
  async (req: AuthedRequest, res) => {
    if (req.user?.role !== "coordinator") {
      res.status(403).json({ error: "Coordinators only" });
      return;
    }

    const filters: AnalyticsFilters = {
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      semester: req.query.semester as "1" | "2" | "all" | undefined,
      courseId: req.query.courseId ? parseInt(req.query.courseId as string) : undefined,
    };

    const format = req.query.format as string || "json";

    const result = await getDetailedProjects(filters);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    if (format === "csv") {
      // Convert to CSV format
      const projects = result.data || [];
      
      if (projects.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=projects.csv");
        res.send("No data available");
        return;
      }

      const headers = Object.keys(projects[0]).join(",");
      const rows = projects.map((p) => {
        return Object.values(p)
          .map((val) => {
            if (val === null || val === undefined) return "";
            const str = String(val);
            // Escape commas and quotes in CSV
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",");
      });

      const csv = [headers, ...rows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=projects-report.csv");
      res.send(csv);
    } else {
      res.json(result.data);
    }
  }
);

export default analyticsRouter;
