import { registerAs } from "@nestjs/config";

export default registerAs("bytez", () => ({
  apiKey: process.env.BYTEZ_API_KEY, // API ключ для bytez.js
}));
