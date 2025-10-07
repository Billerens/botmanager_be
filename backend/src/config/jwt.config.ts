import { registerAs } from "@nestjs/config";

export default registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET || "dev-jwt-secret-key",
  expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  refreshSecret: process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-key",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
}));
