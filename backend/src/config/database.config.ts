import { registerAs } from "@nestjs/config";

export default registerAs("database", () => ({
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USERNAME || "botmanager",
  password: process.env.DATABASE_PASSWORD || "botmanager_password",
  database: process.env.DATABASE_NAME || "botmanager_dev",
  synchronize: process.env.NODE_ENV === "development",
  logging: false,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
}));
