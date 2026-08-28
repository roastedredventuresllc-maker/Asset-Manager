import { defineConfig } from "drizzle-kit";
import path from "path";
import { resolveDatabaseUrl } from "./src/databaseUrl";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
