import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: number };
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string);
    if (typeof payload === "string" || payload.sub === undefined) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = { sub: Number(payload.sub) };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};