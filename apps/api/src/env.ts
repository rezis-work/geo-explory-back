import {
  loadBackendRootEnv,
  logLevelSchema,
  nodeEnvSchema,
  pickPort,
  portSchema,
} from "@geo-explory/backend-shared";
import { z } from "zod";

loadBackendRootEnv(import.meta.url);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    PORT: portSchema,
    LOG_LEVEL: logLevelSchema.optional(),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  })
  .transform((data) => ({
    NODE_ENV: data.NODE_ENV,
    PORT: data.PORT,
    LOG_LEVEL:
      data.LOG_LEVEL ?? (data.NODE_ENV === "production" ? "info" : "debug"),
    isProd: data.NODE_ENV === "production",
    DATABASE_URL: data.DATABASE_URL,
    JWT_ACCESS_SECRET: data.JWT_ACCESS_SECRET,
    ACCESS_TOKEN_EXPIRES_IN: data.ACCESS_TOKEN_EXPIRES_IN,
  }));

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: pickPort(process.env.API_PORT, process.env.PORT, 3001),
  LOG_LEVEL: process.env.LOG_LEVEL,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN,
});
