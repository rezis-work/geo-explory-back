import { refreshTokens, users } from "@geo-explory/backend-shared";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { env } from "../env.js";

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "deleted";
  emailVerified: boolean;
  createdAt: Date;
};

function toAuthUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user: typeof users.$inferSelect): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] },
  );
}

async function createRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });

  return raw;
}

export async function register(
  email: string,
  password: string,
): Promise<AuthUser> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw Object.assign(new Error("Email already registered"), {
      code: "EMAIL_TAKEN",
    });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [user] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), passwordHash })
    .returning();

  return toAuthUser(user);
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: AuthUser; accessToken: string; refreshToken: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Constant-time: always hash even when user not found to prevent timing attacks
  const hash = user?.passwordHash ?? "$2a$12$invalidhashfortimingattackprevention";
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid) {
    throw Object.assign(new Error("Invalid credentials"), {
      code: "INVALID_CREDENTIALS",
    });
  }

  if (user.status !== "active") {
    throw Object.assign(new Error("Account is not active"), {
      code: "ACCOUNT_INACTIVE",
    });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(user.id);

  return { user: toAuthUser(user), accessToken, refreshToken };
}

export async function refresh(
  rawToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        gt(refreshTokens.expiresAt, now),
        isNull(refreshTokens.revokedAt),
      ),
    )
    .limit(1);

  if (!stored) {
    throw Object.assign(new Error("Invalid or expired refresh token"), {
      code: "INVALID_REFRESH_TOKEN",
    });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, stored.userId))
    .limit(1);

  if (!user || user.status !== "active") {
    throw Object.assign(new Error("Account is not active"), {
      code: "ACCOUNT_INACTIVE",
    });
  }

  // Rotate: revoke old, issue new
  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(eq(refreshTokens.id, stored.id));

  const accessToken = signAccessToken(user);
  const newRefreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function getUserById(id: string): Promise<AuthUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user || user.status === "deleted") return null;
  return toAuthUser(user);
}
