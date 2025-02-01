// src/api/dashboard.ts
import express, { Request, Response } from "express";
import {
  getAllPipelineVersions,
  addTagToPipelineVersion,
  ratePipelineVersion,
  markPipelineVersionAsFinetuned
} from "../pipeline";

const router: express.Router = express.Router();

// GET all pipeline version records.
router.get("/versions", (_req: Request, res: Response) => {
  const versions = getAllPipelineVersions();
  res.json(versions);
});

// POST add a tag.
router.post("/versions/:id/tag", (req: Request, res: Response) => {
  const { id } = req.params;
  const { tag } = req.body;
  if (!tag) {
    return res.status(400).json({ error: "Missing tag parameter" });
  }
  const success = addTagToPipelineVersion(id, tag);
  if (success) {
    res.json({ message: `Tag '${tag}' added to pipeline version ${id}` });
  } else {
    res.status(404).json({ error: "Pipeline version not found" });
  }
});

// POST rate a pipeline version.
router.post("/versions/:id/rate", (req: Request, res: Response) => {
  const { id } = req.params;
  const { rating } = req.body;
  if (rating === undefined) {
    return res.status(400).json({ error: "Missing rating parameter" });
  }
  try {
    const success = ratePipelineVersion(id, rating);
    if (success) {
      res.json({ message: `Pipeline version ${id} rated as ${rating}` });
    } else {
      res.status(404).json({ error: "Pipeline version not found" });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST mark as finetuned.
// This endpoint is triggered when the user exports/finetunes outputs.
router.post("/versions/:id/finetune", (req: Request, res: Response) => {
  const { id } = req.params;
  const success = markPipelineVersionAsFinetuned(id);
  if (success) {
    res.json({ message: `Pipeline version ${id} marked as finetuned.` });
  } else {
    res.status(404).json({ error: "Pipeline version not found" });
  }
});

export default router;
