import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const apiDescription = {
  title: "CodeNinja Backend API",
  version: "0.1.0",
  description:
    "REST API documentation for Firebase Functions + Express backend.",
};

const options: { definition: Record<string, any>; apis: string[] } = {
  definition: {
    openapi: "3.1.0",
    info: apiDescription,
    // Relative URL so "Try it out" targets whichever host serves the docs
    servers: [{ url: "/", description: "Current server" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // .ts when running from src (dev), .js when running the compiled build in lib
  apis: [path.join(__dirname, "../routes/**/*.{ts,js}")],
};

export const swaggerSpec = swaggerJsdoc(options);
