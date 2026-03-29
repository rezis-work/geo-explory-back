import winston from "winston";
import { env } from "./env.js";

const { combine, timestamp, errors, printf, colorize, json } = winston.format;

const consoleFormat = combine(
  errors({ stack: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  colorize({ all: !env.isProd }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
    const body = stack ?? String(message);
    return `${ts} [${level}] ${body}${metaStr}`;
  }),
);

const jsonFormat = combine(
  errors({ stack: true }),
  timestamp(),
  json(),
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "geo-explory-worker" },
  transports: [
    new winston.transports.Console({
      format: env.isProd ? jsonFormat : consoleFormat,
    }),
  ],
});
