import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../env.js";
import { requireAuth, type JwtPayload } from "./middleware.js";
import {
  getUserById,
  login,
  logout,
  refresh,
  register,
} from "./service.js";

const router: Router = Router();

const REFRESH_COOKIE = "refresh_token";
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict" as const,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    path: "/auth",
  };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/register
router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    try {
      const user = await register(parsed.data.email, parsed.data.password);
      res.status(201).json({ user });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "EMAIL_TAKEN") {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      next(err);
    }
  },
);

// POST /auth/login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    try {
      const { user, accessToken, refreshToken } = await login(
        parsed.data.email,
        parsed.data.password,
      );
      res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
      res.json({ accessToken, user });
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === "INVALID_CREDENTIALS") {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      if (e.code === "ACCOUNT_INACTIVE") {
        res.status(403).json({ error: "Account is suspended or deleted" });
        return;
      }
      next(err);
    }
  },
);

// POST /auth/refresh
router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!rawToken) {
      res.status(401).json({ error: "No refresh token" });
      return;
    }

    try {
      const { accessToken, refreshToken } = await refresh(rawToken);
      res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
      res.json({ accessToken });
    } catch (err) {
      const e = err as { code?: string };
      if (
        e.code === "INVALID_REFRESH_TOKEN" ||
        e.code === "ACCOUNT_INACTIVE"
      ) {
        res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
        res.status(401).json({ error: "Invalid or expired refresh token" });
        return;
      }
      next(err);
    }
  },
);

// POST /auth/logout
router.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    try {
      if (rawToken) await logout(rawToken);
      res.clearCookie(REFRESH_COOKIE, { path: "/auth" });
      res.json({ message: "Logged out" });
    } catch (err) {
      next(err);
    }
  },
);

// GET /auth/me
router.get(
  "/me",
  requireAuth,
  async (_req: Request, res: Response, next: NextFunction) => {
    const { sub } = res.locals["user"] as JwtPayload;
    try {
      const user = await getUserById(sub);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

export { router as authRouter };
