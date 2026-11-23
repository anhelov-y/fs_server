import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "./validators/auth.validator.ts";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  idParamsSchema,
  listQuerySchema,
} from "./validators/announcements.validator.ts";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const errorSchema = z.object({ error: z.string() });

const validationErrorSchema = z.object({
  error: z.string(),
  details: z.record(z.string(), z.array(z.string())),
});

const publicUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  name: z.string(),
});

const meSchema = publicUserSchema.extend({ createdAt: z.string() });

const authResponseSchema = z.object({
  user: publicUserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

const announcementSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  category: z.enum(["sale", "service", "job", "other"]),
  userId: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: publicUserSchema,
});

const announcementListSchema = z.object({
  data: z.array(announcementSchema),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    totalPages: z.number(),
    perPage: z.number(),
  }),
});

const json = (schema: z.ZodType) => ({
  content: { "application/json": { schema } },
});

const security = [{ bearerAuth: [] }];

const badRequest = { description: "Validation failed", ...json(validationErrorSchema) };
const unauthorized = { description: "Unauthorized", ...json(errorSchema) };
const forbidden = { description: "Access denied", ...json(errorSchema) };
const notFound = { description: "Not found", ...json(errorSchema) };

// Auth

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Register a new user",
  request: { body: { required: true, ...json(registerSchema) } },
  responses: {
    201: { description: "User created", ...json(authResponseSchema) },
    400: badRequest,
    409: { description: "Username or email already taken", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  request: { body: { required: true, ...json(loginSchema) } },
  responses: {
    200: { description: "Logged in", ...json(authResponseSchema) },
    400: badRequest,
    401: unauthorized,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Get a new access token using a refresh token",
  request: { body: { required: true, ...json(refreshSchema) } },
  responses: {
    200: {
      description: "New token pair",
      ...json(z.object({ accessToken: z.string(), refreshToken: z.string() })),
    },
    400: badRequest,
    401: unauthorized,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Log out and invalidate refresh tokens",
  security,
  responses: {
    204: { description: "Logged out" },
    401: unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "Get the current user profile",
  security,
  responses: {
    200: { description: "Current user", ...json(meSchema) },
    401: unauthorized,
  },
});

// Announcements

registry.registerPath({
  method: "get",
  path: "/announcements",
  tags: ["Announcements"],
  summary: "List announcements with search, sorting and pagination",
  request: { query: listQuerySchema },
  responses: {
    200: { description: "Page of announcements", ...json(announcementListSchema) },
    400: badRequest,
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Get one announcement",
  request: { params: idParamsSchema },
  responses: {
    200: { description: "Announcement", ...json(announcementSchema) },
    400: badRequest,
    404: notFound,
  },
});

registry.registerPath({
  method: "post",
  path: "/announcements",
  tags: ["Announcements"],
  summary: "Create an announcement",
  security,
  request: { body: { required: true, ...json(createAnnouncementSchema) } },
  responses: {
    201: { description: "Announcement created", ...json(announcementSchema) },
    400: badRequest,
    401: unauthorized,
  },
});

registry.registerPath({
  method: "patch",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Update your own announcement",
  security,
  request: {
    params: idParamsSchema,
    body: { required: true, ...json(updateAnnouncementSchema) },
  },
  responses: {
    200: { description: "Announcement updated", ...json(announcementSchema) },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

registry.registerPath({
  method: "delete",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Delete your own announcement",
  security,
  request: { params: idParamsSchema },
  responses: {
    204: { description: "Announcement deleted" },
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Announcements dashboard API",
      version: "1.0.1",
      description: "REST API with JWT auth",
    },
    servers: [{ url: "http://localhost:3000" }],
  });
}
