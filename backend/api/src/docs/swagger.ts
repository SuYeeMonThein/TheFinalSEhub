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
    servers: [
      { url: "http://localhost:5001", description: "Local development server" },
    ],
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
  apis: [path.join(__dirname, "../routes/**/*.ts")],
};

export const swaggerSpec = swaggerJsdoc(options);
