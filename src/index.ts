// src/index.ts
export { DistilPipeline } from "./pipeline";

import express from "express";
import { engine } from 'express-handlebars';
import * as path from 'path';
import dashboardRouter from "./api/dashboard";
import { config } from "./config";

const app: express.Application = express();

// Configure handlebars
app.engine('html', engine({
  extname: '.html',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'public/templates/layouts'),
  partialsDir: path.join(__dirname, 'public/templates/partials'),
  helpers: {
    truncate: (str: string, len: number) => str.substring(0, len),
    formatDate: (date: string) => new Date(date).toLocaleString(),
    json: (obj: any) => JSON.stringify(obj, null, 2),
    times: function (n: number, block: any) {
      let accum = '';
      for (let i = 1; i <= n; ++i)
        accum += block.fn(i);
      return accum;
    },
    lte: (a: number, b: number) => a <= b
  }
}));
// Change the views path to point to the source templates directory
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public/templates'));

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (_req, res) => {
  res.render('index');
});

// Add finetune page route
app.get('/finetune', (_req, res) => {
  res.render('layouts/finetune');
});

// API routes
app.use("/dashboard", dashboardRouter);
// app.use("/api/finetune", finetuneRouter);

// Start the dashboard server
const port = config.dashboard.port;
// disable with RUN_DASHBOARD false
if (process.env.RUN_DASHBOARD !== "false") {
  console.log("Starting dashboard server...");
  app.listen(port, () => {
    console.log(`Dashboard server is running on port ${port}`);
    console.log(`View the dashboard at http://localhost:${port}`);
  });
}

export default app;
