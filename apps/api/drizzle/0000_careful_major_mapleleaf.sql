CREATE SCHEMA "users";
--> statement-breakpoint
CREATE TYPE "public"."session_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "users"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "session_status" NOT NULL,
	"provider" "session_provider" NOT NULL,
	"provider_access_token" text NOT NULL,
	"provider_access_token_iv" text NOT NULL,
	"provider_access_token_tag" text NOT NULL,
	"provider_access_token_expires_at" timestamp with time zone NOT NULL,
	"provider_refresh_token" text NOT NULL,
	"provider_refresh_token_iv" text NOT NULL,
	"provider_refresh_token_tag" text NOT NULL,
	"provider_scope" text NOT NULL,
	"provider_refresh_token_expires_at" timestamp with time zone NOT NULL,
	"provider_account_id" text NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "users"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"avatar" text,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_provider_account_id_unique" UNIQUE("provider_account_id")
);
--> statement-breakpoint
ALTER TABLE "users"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_provider_refresh_token_idx" ON "users"."sessions" USING btree ("provider_refresh_token");--> statement-breakpoint
CREATE INDEX "sessions_provider_account_id_idx" ON "users"."sessions" USING btree ("provider_account_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "users"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "users"."sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sessions_last_accessed_at_idx" ON "users"."sessions" USING btree ("last_accessed_at");--> statement-breakpoint
CREATE INDEX "sessions_revoked_at_idx" ON "users"."sessions" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "users"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_provider_idx" ON "users"."sessions" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users"."users" USING btree ("email");