import { Hono } from "hono";
import authRoutes from "@/modules/auth/auth.routes";

const apiV1Routes = new Hono();

apiV1Routes.route("/v1/auth", authRoutes);

export default apiV1Routes;
