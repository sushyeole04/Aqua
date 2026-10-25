import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Reads DATABASE_URL from .env / environment variables
    url: env("DATABASE_URL"),
  },
});
