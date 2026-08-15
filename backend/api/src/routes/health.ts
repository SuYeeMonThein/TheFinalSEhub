import { Router } from 'express';

const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Service health probe
 *     tags:
 *       - System
 *     responses:
 *       '200':
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default healthRouter;
