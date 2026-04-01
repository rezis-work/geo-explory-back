import cors from "cors";
import express from "express";
import os from "os";
import { env } from "./env.js";
import { logger } from "./logger.js";

const app = express();
const startedAt = new Date().toISOString();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info("request completed", {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

app.get("/health", (_req, res) => {
  const mem = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.status(200).json({
    app: "worker",
    status: "ok",
    timestamp: new Date().toISOString(),
    startedAt,
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        externalBytes: mem.external,
      },
      cpu: {
        userMicros: cpuUsage.user,
        systemMicros: cpuUsage.system,
      },
    },
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(os.uptime()),
      loadAvg: os.loadavg(),
      memory: {
        totalBytes: os.totalmem(),
        freeBytes: os.freemem(),
      },
      cpuCount: os.cpus().length,
    },
    config: {
      env: env.NODE_ENV,
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
    },
  });
});

app.listen(env.PORT, () => {
  logger.info("server started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  });
});
