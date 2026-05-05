-- Down migration paired with 0000_mature_slapstick.sql.
-- Drizzle-kit does not auto-generate down migrations — applied manually.
-- Reviewers: drop in reverse dependency order so FK cascades do not fire
-- mid-rollback.

DROP INDEX IF EXISTS "users_handle_unique";
--> statement-breakpoint
DROP INDEX IF EXISTS "post_tags_tag_post_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "posts_created_live_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "posts_author_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "follows_target_follower_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "post_tags";
--> statement-breakpoint
DROP TABLE IF EXISTS "tag_follows";
--> statement-breakpoint
DROP TABLE IF EXISTS "follows";
--> statement-breakpoint
DROP TABLE IF EXISTS "tags";
--> statement-breakpoint
DROP TABLE IF EXISTS "provider_profiles";
--> statement-breakpoint
DROP TABLE IF EXISTS "posts";
--> statement-breakpoint
DROP TABLE IF EXISTS "verification_tokens";
--> statement-breakpoint
DROP TABLE IF EXISTS "sessions";
--> statement-breakpoint
DROP TABLE IF EXISTS "accounts";
--> statement-breakpoint
DROP TABLE IF EXISTS "users";
--> statement-breakpoint
-- The `citext` extension is left in place because dropping it could affect
-- other databases on a shared cluster. Drop manually if you are certain.
-- DROP EXTENSION IF EXISTS citext;
