import { Request, Response } from "express";
import prisma from "../../prisma/client.ts";

const PER_PAGE = 10;
const userSelect = { id: true, username: true, email: true, name: true };

export const getAnnouncements = async (_req: Request, res: Response) => {
  const { search, sort, page = 1 } = res.locals.query as {
    search?: string;
    sort?: "newest" | "oldest";
    page?: number;
  };

  const where = search
    ? { title: { contains: search, mode: "insensitive" as const } }
    : {};

  const [total, data] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { user: { select: userSelect } },
    }),
  ]);

  res.status(200).json({
    data,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
      perPage: PER_PAGE,
    },
  });
};

export const getAnnouncementById = async (_req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { user: { select: userSelect } },
  });
  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }

  res.status(200).json(announcement);
};

export const createAnnouncement = async (req: Request, res: Response) => {
  const { title, description, price, category } = req.body;

  const announcement = await prisma.announcement.create({
    data: { title, description, price, category, userId: req.user!.sub },
    include: { user: { select: userSelect } },
  });

  res.status(201).json(announcement);
};

export const updateAnnouncement = async (req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  if (existing.userId !== req.user!.sub) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const updated = await prisma.announcement.update({
    where: { id },
    data: req.body,
    include: { user: { select: userSelect } },
  });

  res.status(200).json(updated);
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
  const { id } = res.locals.params as { id: number };

  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }
  if (existing.userId !== req.user!.sub) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await prisma.announcement.delete({ where: { id } });
  res.status(204).end();
};