import { Request, Response, NextFunction } from "express";
import { ZodType } from "zod";

type Source = "body" | "params" | "query";

const validate =
  (source: Source) => (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
  error: "Validation failed",
  details: {
    [source]: result.error.issues.map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message
    ),
  },
});
    }
    if (source === "body") {
      req.body = result.data;
    } else {
      res.locals[source] = result.data;
    }
    next();
  };

export const validateBody = validate("body");
export const validateParams = validate("params");
export const validateQuery = validate("query");