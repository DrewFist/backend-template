CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
ALTER TABLE "users"."users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;