-- Down migration paired with 0001_tough_songbird.sql
ALTER TABLE "posts" DROP COLUMN IF EXISTS "body_html_version";
--> statement-breakpoint
ALTER TABLE "posts" DROP COLUMN IF EXISTS "body_html";
