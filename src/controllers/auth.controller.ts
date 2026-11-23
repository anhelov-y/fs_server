import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import prisma from "../../prisma/client.ts";

const accessSecret = () => process.env.JWT_SECRET as string;
const refreshSecret = () => `${process.env.JWT_SECRET}_refresh`;

const createTokens = (userId: number) => {
  const accessToken = jwt.sign({ sub: String(userId) }, accessSecret(), {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ sub: String(userId) }, refreshSecret(), {
    expiresIn: "7d",
    jwtid: randomUUID(),
  });
  return { accessToken, refreshToken };
};

const toPublicUser = (user: {
  id: number;
  username: string;
  email: string;
  name: string;
}) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.name,
});

export const register = async (req: Request, res: Response) => {
  const { username, email, password, name } = req.body;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
  });
  if (existing) {
    res.status(409).json({ error: "Username or email already taken" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, email, password: hashedPassword, name },
  });

  const tokens = createTokens(user.id);
  await prisma.refreshToken.create({
    data: { token: tokens.refreshToken, userId: user.id },
  });

  res.status(201).json({ user: toPublicUser(user), ...tokens });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username } });
  const passwordOk = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !passwordOk) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const tokens = createTokens(user.id);
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({
      data: { token: tokens.refreshToken, userId: user.id },
    }),
  ]);

  res.status(200).json({ user: toPublicUser(user), ...tokens });
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  try {
    jwt.verify(refreshToken, refreshSecret());
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });
  if (!stored) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const tokens = createTokens(stored.userId);
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { token: refreshToken } }),
    prisma.refreshToken.create({
      data: { token: tokens.refreshToken, userId: stored.userId },
    }),
  ]);

  res.status(200).json(tokens);
};

export const logout = async (req: Request, res: Response) => {
  await prisma.refreshToken.deleteMany({ where: { userId: req.user!.sub } });
  res.status(204).end();
};

export const me = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, username: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(200).json(user);
};