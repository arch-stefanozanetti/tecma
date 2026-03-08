import cors from "cors";
import express from "express";
import { ENV } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { v1Router } from "./routes/v1.js";

const bootstrap = async () => {
  await connectDb();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/v1", v1Router);

  app.listen(ENV.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`be-followup-v3 listening on :${ENV.PORT}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start be-followup-v3", error);
  process.exit(1);
});
