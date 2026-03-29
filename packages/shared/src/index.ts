import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Load `backend/.env` when running from `apps/<name>/src/*`. */
export function loadBackendRootEnv(importMetaUrl: string) {
  const dir = path.dirname(fileURLToPath(importMetaUrl));
  const backendRoot = path.resolve(dir, "../../..");
  config({ path: path.join(backendRoot, ".env") });
}

export const nodeEnvSchema = z.enum(["development", "production", "test"]);

export const portSchema = z.coerce.number().int().min(1).max(65535);

export const logLevelSchema = z.enum([
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
]);

export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export function pickPort(
  primary: string | undefined,
  fallbackEnv: string | undefined,
  defaultPort: number,
): number {
  const raw = primary ?? fallbackEnv;
  if (raw === undefined || raw === "") {
    return defaultPort;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return defaultPort;
  }
  return n;
}
