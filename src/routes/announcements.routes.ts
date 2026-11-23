import { Router } from "express";
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/announcements.controller.ts";
import { authenticate } from "../middleware/authenticate.ts";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.ts";
import {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  idParamsSchema,
  listQuerySchema,
} from "../validators/announcements.validator.ts";

const router = Router();

router.get("/", validateQuery(listQuerySchema), getAnnouncements);
router.get("/:id", validateParams(idParamsSchema), getAnnouncementById);
router.post("/", authenticate, validateBody(createAnnouncementSchema), createAnnouncement);
router.patch(
  "/:id",
  authenticate,
  validateParams(idParamsSchema),
  validateBody(updateAnnouncementSchema),
  updateAnnouncement
);
router.delete("/:id", authenticate, validateParams(idParamsSchema), deleteAnnouncement);

export default router;