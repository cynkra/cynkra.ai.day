import { customType } from "drizzle-orm/pg-core";

// Postgres `citext` (case-insensitive text).
// Requires `CREATE EXTENSION IF NOT EXISTS citext` in the first migration.
export const citext = customType<{ data: string; driverData: string }>({
  dataType: () => "citext",
});
