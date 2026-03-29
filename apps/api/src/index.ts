import cors from "cors";
import express from "express";
import { env } from "./env.js";
import { logger } from "./logger.js";

const app = express();

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
  res.status(200).json({
    app: "api",
    status: "ok",
    uptime: process.uptime(),
    env: env.NODE_ENV,
  });
});

app.listen(env.PORT, () => {
  logger.info("server started", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  });
});
