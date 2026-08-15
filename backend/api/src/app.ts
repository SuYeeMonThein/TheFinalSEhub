import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { registerRoutes } from "./routes";
import { swaggerSpec } from "./docs/swagger";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";

export const createApp = () => {
  const app = express();

  // Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
  app.use(helmet());

  // CORS — restrict to configured frontend origins
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );

  // Global rate limit — 1000 requests per 15 minutes per IP (relaxed for development)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Too many requests, please try again later." },
    }),
  );

  app.use(express.json());

  // Swagger docs — only accessible in non-production environments
  if (process.env.NODE_ENV !== "production") {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get("/docs.json", (_req, res) => {
      res.json(swaggerSpec);
    });
  }

  registerRoutes(app);

  app.use(errorHandler);

  return app;
};
