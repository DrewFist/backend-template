import { type UserRole } from "@repo/db";
import { type MiddlewareHandler } from "hono";
import { type AppBindings } from "../types";
import { StatusCodes } from "@repo/config";
import { HTTPException } from "hono/http-exception";

export const enforceRoleMiddleware = (role: UserRole): MiddlewareHandler<AppBindings> => {
  return (c, next) => {
    if (c.var.user?.role !== role) {
      throw new HTTPException(StatusCodes.HTTP_403_FORBIDDEN, {
        res: c.json({ message: "Forbidden" }, StatusCodes.HTTP_403_FORBIDDEN),
      });
    }

    return next();
  };
};
