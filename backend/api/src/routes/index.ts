import { Express } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import usersRouter from "./users";
import projectsRouter from "./projects";
import coursesRouter from "./courses";
import analyticsRouter from "./analytics";
import studentsRouter from "./students";
import commentsRouter from "./comments";
import rubricsRouter from "./rubrics";

export const registerRoutes = (app: Express): void => {
  app.use("/health", healthRouter);
  app.use("/profile", profileRouter);
  app.use("/users", usersRouter);
  app.use("/projects", projectsRouter);
  app.use("/courses", coursesRouter);
  app.use("/analytics", analyticsRouter);
  app.use("/students", studentsRouter);
  app.use("/comments", commentsRouter);
  app.use("/rubrics", rubricsRouter);
};
