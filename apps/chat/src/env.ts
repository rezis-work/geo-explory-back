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
  })
  .transform((data) => ({
    NODE_ENV: data.NODE_ENV,
    PORT: data.PORT,
    LOG_LEVEL:
      data.LOG_LEVEL ??
      (data.NODE_ENV === "production" ? "info" : "debug"),
    isProd: data.NODE_ENV === "production",
  }));

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: pickPort(process.env.CHAT_PORT, process.env.PORT, 3002),
  LOG_LEVEL: process.env.LOG_LEVEL,
});
