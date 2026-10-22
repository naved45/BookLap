import "dotenv/config";
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);
export const config = {
  port: int(process.env.PORT, 4000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/bookloop",
  jwtSecret:
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-change-me"),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  },
  isProd: process.env.NODE_ENV === "production",
  rl: {
    authMax: int(process.env.RL_AUTH_MAX, 10),
    authWindowMs: int(process.env.RL_AUTH_WINDOW_MIN, 15) * 60 * 1000,
    publicMax: int(process.env.RL_PUBLIC_MAX, 300),
    userMax: int(process.env.RL_USER_MAX, 600),
  },
};
if (!config.jwtSecret) throw new Error("JWT_SECRET must be set in production");
