import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
if (
  !process.env.MONGODB_URI ||
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32
)
  throw new Error(
    "Configura MONGODB_URI y SESSION_SECRET (mínimo 32 caracteres) en server/.env",
  );
await mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
});
const server = createApp().listen(process.env.PORT || 3001, () =>
  console.log(`Ayni API: http://localhost:${process.env.PORT || 3001}`),
);
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
