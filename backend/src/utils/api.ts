import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid id parameter");
  }
  return id;
}

export function toValidationMessage(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`).join("; ");
}
