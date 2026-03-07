import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config();

function resolveDatabasePath(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must use a file: URL for SQLite");
  }

  const value = rawUrl.slice("file:".length);
  if (value.startsWith("/")) {
    return value;
  }

  return path.resolve(process.cwd(), "prisma", value);
}

try {
  const databaseUrl = process.env.DATABASE_URL;
  const databasePath = resolveDatabasePath(databaseUrl);

  const sql = execSync("npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(path.resolve(process.cwd(), "prisma"), { recursive: true });
  if (fs.existsSync(databasePath)) {
    fs.rmSync(databasePath);
  }
  fs.writeFileSync(path.resolve(process.cwd(), "prisma/init.sql"), sql, "utf8");

  execSync(`sqlite3 "${databasePath}"`, {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });

  execSync("npx prisma generate", { stdio: "inherit" });
  process.stdout.write(`Database initialized at ${databasePath}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Database init failed"}\n`);
  process.exit(1);
}
