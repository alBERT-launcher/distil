// src/api/dashboard.ts
import express, { Request, Response } from "express";
import {
  getAllPipelineVersions,
  addTagToPipelineVersion,
  ratePipelineVersion,
  markPipelineVersionAsFinetuned
} from "../pipeline";

const router: express.Router = express.Router();

// GET all pipelines
router.get("/pipelines", async (req: Request, res: Response) => {
  try {
    const versions = await getAllPipelineVersions();
    // Group versions by pipeline name
    const pipelines = versions.reduce((acc: any, version) => {
      if (!acc[version.pipelineName]) {
        acc[version.pipelineName] = {
          name: version.pipelineName,
          versions: []
        };
      }
      acc[version.pipelineName].versions.push(version);
      return acc;
    }, {});

    // If this is an HTMX request, render the template
    if (req.headers['hx-request']) {
      res.render('pipeline-list', { 
        layout: false,
        pipelines: Object.values(pipelines)
      });
    } else {
      // Otherwise return JSON
      res.json(Object.values(pipelines));
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pipelines" });
  }
});

// GET pipeline versions for a specific pipeline
router.get("/pipelines/:name/versions", async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const versions = await getAllPipelineVersions();
    const pipelineVersions = versions.filter(v => v.pipelineName === name);
    if (pipelineVersions.length === 0) {
      return res.status(404).json({ error: "Pipeline not found" });
    }

    // If this is an HTMX request, render the template
    if (req.headers['hx-request']) {
      res.render('pipeline-versions', {
        layout: false,
        pipelineName: name,
        versions: pipelineVersions
      });
    } else {
      // Otherwise return JSON
      res.json(pipelineVersions);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pipeline versions" });
  }
});

// GET generations for a specific pipeline version
router.get("/pipelines/:name/versions/:id/generations", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const versions = await getAllPipelineVersions();
    const version = versions.find(v => v.id === id);
    if (!version) {
      return res.status(404).json({ error: "Pipeline version not found" });
    }
    res.json(version.generations || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch generations" });
  }
});

// POST add a tag to a pipeline version
router.post("/pipelines/:name/versions/:id/tag", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;
    if (!tag) {
      return res.status(400).json({ error: "Missing tag parameter" });
    }
    const success = await addTagToPipelineVersion(id, tag);
    if (success) {
      // If this is an HTMX request, refresh the version view
      if (req.headers['hx-request']) {
        const versions = await getAllPipelineVersions();
        const version = versions.find(v => v.id === id);
        if (version) {
          res.render('pipeline-versions', {
            layout: false,
            pipelineName: version.pipelineName,
            versions: [version]
          });
        } else {
          res.status(404).json({ error: "Pipeline version not found" });
        }
      } else {
        res.json({ message: `Tag '${tag}' added to pipeline version ${id}` });
      }
    } else {
      res.status(404).json({ error: "Pipeline version not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to add tag" });
  }
});

// POST rate a generation from a pipeline version
router.post("/pipelines/:name/versions/:id/generations/:genId/rate", async (req: Request, res: Response) => {
  try {
    const { id, genId } = req.params;
    const { rating } = req.body;
    if (rating === undefined) {
      return res.status(400).json({ error: "Missing rating parameter" });
    }
    const success = await ratePipelineVersion(id, rating);
    if (success) {
      // If this is an HTMX request, refresh the version view
      if (req.headers['hx-request']) {
        const versions = await getAllPipelineVersions();
        const version = versions.find(v => v.id === id);
        if (version) {
          res.render('pipeline-versions', {
            layout: false,
            pipelineName: version.pipelineName,
            versions: [version]
          });
        } else {
          res.status(404).json({ error: "Pipeline version not found" });
        }
      } else {
        res.json({ message: `Generation ${genId} from pipeline version ${id} rated as ${rating}` });
      }
    } else {
      res.status(404).json({ error: "Pipeline version or generation not found" });
    }
  } catch (error: any) {
    if (error.message === "Rating must be between 1 and 5.") {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to rate generation" });
    }
  }
});

// POST mark selected generations as finetuned
router.post("/pipelines/:name/versions/:id/generations/finetune", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { generationIds } = req.body;
    if (!Array.isArray(generationIds)) {
      return res.status(400).json({ error: "Missing or invalid generationIds parameter" });
    }
    const success = await markPipelineVersionAsFinetuned(id);
    if (success) {
      // If this is an HTMX request, refresh the version view
      if (req.headers['hx-request']) {
        const versions = await getAllPipelineVersions();
        const version = versions.find(v => v.id === id);
        if (version) {
          res.render('pipeline-versions', {
            layout: false,
            pipelineName: version.pipelineName,
            versions: [version]
          });
        } else {
          res.status(404).json({ error: "Pipeline version not found" });
        }
      } else {
        res.json({ 
          message: `Selected generations from pipeline version ${id} marked for finetuning`,
          generationIds
        });
      }
    } else {
      res.status(404).json({ error: "Pipeline version not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to mark generations as finetuned" });
  }
});

export default router;
