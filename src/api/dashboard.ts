// src/api/dashboard.ts
import express, { Request, Response } from "express";
import {
  getAllPipelineVersions,
  addTagToPipelineVersion,
  ratePipelineVersion,
  markPipelineVersionAsFinetuned,
  getGenerationsForVersion,
  getGenerationById,
  rateGeneration,
  markGenerationsForFinetuning
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
    const { name, id } = req.params;
    const versions = await getAllPipelineVersions();
    const version = versions.find(v => v.id === id);
    if (!version) {
      return res.status(404).json({ error: "Pipeline version not found" });
    }

    const generations = await getGenerationsForVersion(name, id);

    // If this is an HTMX request, render the template
    if (req.headers['hx-request']) {
      res.render('generations-list', {
        layout: false,
        pipelineName: version.pipelineName,
        versionId: version.id,
        generations
      });
    } else {
      // Otherwise return JSON
      res.json(generations);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch generations" });
  }
});

// GET details for a specific generation
router.get("/pipelines/:name/versions/:id/generations/:genId", async (req: Request, res: Response) => {
  try {
    const { name, id, genId } = req.params;
    
    const generation = await getGenerationById(name, genId);

    // If this is an HTMX request, render the template
    if (req.headers['hx-request']) {
      res.render('generation-detail', {
        layout: false,
        pipelineName: generation.metadata.pipelineName,
        versionId: id,
        ...generation
      });
    } else {
      // Otherwise return JSON
      res.json(generation);
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch generation details" });
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

// POST rate a generation
router.post("/pipelines/:name/versions/:id/generations/:genId/rate", async (req: Request, res: Response) => {
  try {
    const { genId } = req.params;
    const { rating } = req.body;

    const success = await rateGeneration(genId, parseInt(rating));
    if (!success) {
      return res.status(500).json({ error: "Failed to rate generation" });
    }

    res.redirect(303, req.headers.referer || '/');
  } catch (error) {
    res.status(500).json({ error: "Failed to rate generation" });
  }
});

// POST mark generation for finetuning
router.post("/pipelines/:name/versions/:id/generations/finetune", async (req: Request, res: Response) => {
  try {
    const { generationIds } = req.body;
    if (!Array.isArray(generationIds)) {
      return res.status(400).json({ error: "Invalid generationIds parameter" });
    }

    const success = await markGenerationsForFinetuning(generationIds);
    if (!success) {
      return res.status(500).json({ error: "Failed to mark generations for finetuning" });
    }

    res.redirect(303, req.headers.referer || '/');
  } catch (error) {
    res.status(500).json({ error: "Failed to mark generation for finetuning" });
  }
});

export default router;
