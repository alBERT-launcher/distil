// src/index.ts
import { DistilPipeline } from "./pipeline";
export { DistilPipeline } from "./pipeline";

import express from "express";
import dashboardRouter from "./api/dashboard";
import { config } from "./config";

const app: express.Application = express();
app.use(express.json());
app.use("/dashboard", dashboardRouter);

// Start the dashboard server if RUN_DASHBOARD is set.
if (process.env.RUN_DASHBOARD === "true") {
  const port = config.dashboard.port;
  app.listen(port, () => {
    console.log(`Dashboard server is running on port ${port}`);
  });
}

export default app;
