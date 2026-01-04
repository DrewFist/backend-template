import { MiddlewareHandler } from "hono";
import { AppBindings } from "../types";
import { HTTPException } from "hono/http-exception";
import { StatusCodes } from "@repo/config";

export const enforceUserMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!c.var.user) {
    throw new HTTPException(StatusCodes.HTTP_401_UNAUTHORIZED, {
      res: c.json({ message: "Authentication required" }, StatusCodes.HTTP_401_UNAUTHORIZED),
    });
  }

  await next();
};
