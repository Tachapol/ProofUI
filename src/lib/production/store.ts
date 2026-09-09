import {
  PublishedMetadata,
  ProductionTelemetryPayload,
  AggregatedProductionEvidence,
  SessionDurationBucket,
} from "./schemas";
import { UXAnalysisViewport } from "../optimization/schemas";
import {
  UXExperiment,
  CreateExperimentRequest,
} from "../experiment/schemas";
import {
  RawVariantEvidence,
  evaluateExperiment,
  ExperimentEvaluationResult,
} from "../experiment/decisioning";

interface PublishedRecord {
  metadata: PublishedMetadata;
  html: string;
}

export class ProductionStore {
  // Map key: `${projectId}::${pageId}::${versionId}`
  private publishedVersions: Map<string, PublishedRecord> = new Map();

  // Map key: `${projectId}::${versionId}`
  private aggregatedEvidence: Map<string, AggregatedProductionEvidence> = new Map();

  // Map key: `exp_${id}`
  private experiments: Map<string, UXExperiment> = new Map();

  // Map key: `${experimentId}::${variant}` (where variant is 'control' or 'variant')
  private experimentEvidence: Map<string, RawVariantEvidence> = new Map();

  // Map key: `${projectId}::${pageId}` -> currently active versionId
  private activePublishedVersions: Map<string, string> = new Map();

  private makeKey(projectId: string, pageId: string, versionId: string): string {
    return `${projectId}::${pageId}::${versionId}`;
  }

  private makeEvidenceKey(projectId: string, versionId: string): string {
    return `${projectId}::${versionId}`;
  }

  /**
   * Registers a published page version.
   */
  public publishVersion(metadata: PublishedMetadata, html: string): void {
    const key = this.makeKey(metadata.projectId, metadata.pageId, metadata.versionId);
    this.publishedVersions.set(key, { metadata, html });
    this.activePublishedVersions.set(`${metadata.projectId}::${metadata.pageId}`, metadata.versionId);

    // Initialize aggregated evidence entry if not yet created
    const evidenceKey = this.makeEvidenceKey(metadata.projectId, metadata.versionId);
    if (!this.aggregatedEvidence.has(evidenceKey)) {
      this.aggregatedEvidence.set(evidenceKey, {
        projectId: metadata.projectId,
        pageId: metadata.pageId,
        versionId: metadata.versionId,
        totalSessions: 0,
        viewportDistribution: {
          desktop: 0,
          tablet: 0,
          mobile: 0,
        },
        durationBuckets: {
          "<15s": 0,
          "15-30s": 0,
          "30-60s": 0,
          "1-3m": 0,
          ">3m": 0,
        },
        scrollDepthDistribution: {
          reached25: 0,
          reached50: 0,
          reached75: 0,
          reached100: 0,
        },
        ctaClickCounts: {},
        elementClickCounts: {},
        mostClickedElements: [],
        lowInteractionImportantElements: [],
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Verifies if a given project, page, and version was officially published.
   * Disallows arbitrary or forged project IDs.
   */
  public hasPublishedVersion(projectId: string, pageId: string, versionId: string): boolean {
    const key = this.makeKey(projectId, pageId, versionId);
    return this.publishedVersions.has(key);
  }

  /**
   * Retrieves a published version record.
   */
  public getPublishedVersion(projectId: string, pageId: string, versionId: string): PublishedRecord | null {
    const key = this.makeKey(projectId, pageId, versionId);
    return this.publishedVersions.get(key) || null;
  }

  /**
   * Retrieves all published versions for a project.
   */
  public getPublishedVersionsForProject(projectId: string): PublishedMetadata[] {
    const results: PublishedMetadata[] = [];
    for (const record of this.publishedVersions.values()) {
      if (record.metadata.projectId === projectId) {
        results.push(record.metadata);
      }
    }
    return results;
  }

  /**
   * Ingests a validated telemetry summary and aggregates it into bounded metrics.
   * Never stores client IPs, session tokens, or sensitive values.
   */
  public recordTelemetry(payload: ProductionTelemetryPayload): boolean {
    if (!this.hasPublishedVersion(payload.projectId, payload.pageId, payload.versionId)) {
      return false;
    }
    if (payload.experimentId || payload.variantId) {
      const exp = payload.experimentId ? this.experiments.get(payload.experimentId) : null;
      if (!exp || !payload.variantId || exp.projectId !== payload.projectId || exp.pageId !== payload.pageId ||
        payload.versionId !== (payload.variantId === "control" ? exp.controlVersionId : exp.variantVersionId)) return false;
    }

    const evidenceKey = this.makeEvidenceKey(payload.projectId, payload.versionId);
    let agg = this.aggregatedEvidence.get(evidenceKey);

    if (!agg) {
      agg = {
        projectId: payload.projectId,
        pageId: payload.pageId,
        versionId: payload.versionId,
        totalSessions: 0,
        viewportDistribution: {
          desktop: 0,
          tablet: 0,
          mobile: 0,
        },
        durationBuckets: {
          "<15s": 0,
          "15-30s": 0,
          "30-60s": 0,
          "1-3m": 0,
          ">3m": 0,
        },
        scrollDepthDistribution: {
          reached25: 0,
          reached50: 0,
          reached75: 0,
          reached100: 0,
        },
        ctaClickCounts: {},
        elementClickCounts: {},
        mostClickedElements: [],
        lowInteractionImportantElements: [],
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      this.aggregatedEvidence.set(evidenceKey, agg);
    }

    // 1. Session & Viewport
    agg.totalSessions += 1;
    const vp = payload.viewport as UXAnalysisViewport;
    agg.viewportDistribution[vp] = (agg.viewportDistribution[vp] || 0) + 1;

    // 2. Duration Bucket
    const bucket = payload.sessionDurationBucket as SessionDurationBucket;
    agg.durationBuckets[bucket] = (agg.durationBuckets[bucket] || 0) + 1;

    // 3. Scroll Depth Thresholds
    if (payload.scrollDepth.reached25) agg.scrollDepthDistribution.reached25 += 1;
    if (payload.scrollDepth.reached50) agg.scrollDepthDistribution.reached50 += 1;
    if (payload.scrollDepth.reached75) agg.scrollDepthDistribution.reached75 += 1;
    if (payload.scrollDepth.reached100) agg.scrollDepthDistribution.reached100 += 1;

    // 4. CTA Clicks
    if (payload.ctaClicks) {
      for (const [id, count] of Object.entries(payload.ctaClicks)) {
        agg.ctaClickCounts[id] = (agg.ctaClickCounts[id] || 0) + count;
      }
    }

    // 5. Element Clicks
    if (payload.elementClicks) {
      for (const [id, count] of Object.entries(payload.elementClicks)) {
        agg.elementClickCounts[id] = (agg.elementClickCounts[id] || 0) + count;
      }
    }

    // 6. Most Clicked Elements (Top 10)
    const sortedClicks = Object.entries(agg.elementClickCounts)
      .map(([editorId, count]) => ({ editorId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    agg.mostClickedElements = sortedClicks;

    // 7. Low-Interaction Important Elements:
    // Identify CTAs or elements that were clicked 0 times while scroll reached >= 75%
    const lowInteraction: Array<{ editorId: string; reason: string }> = [];
    const publishedRecord = this.getPublishedVersion(payload.projectId, payload.pageId, payload.versionId);
    if (publishedRecord && agg.scrollDepthDistribution.reached75 > 0) {
      // Find buttons/anchors in published HTML with data-editor-id that received 0 clicks
      const editorIdRegex = /data-editor-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
      let match;
      while ((match = editorIdRegex.exec(publishedRecord.html)) !== null) {
        const id = match[1];
        const clicks = agg.elementClickCounts[id] || agg.ctaClickCounts[id] || 0;
        if (clicks === 0 && !lowInteraction.some((item) => item.editorId === id)) {
          lowInteraction.push({
            editorId: id,
            reason: `Element reached by users (>=75% scroll) but received 0 clicks across ${agg.totalSessions} sessions.`,
          });
        }
      }
    }
    agg.lowInteractionImportantElements = lowInteraction.slice(0, 10);

    // 8. Experiment isolated aggregation (if payload has experimentId & variantId)
    if (payload.experimentId && payload.variantId) {
      const exp = this.experiments.get(payload.experimentId);
      if (exp && exp.status === "running") {
        const expEvidenceKey = `${exp.id}::${payload.variantId}`;
        let expEv = this.experimentEvidence.get(expEvidenceKey);
        if (!expEv) {
          expEv = {
            sessions: 0,
            ctaClicks: 0,
            scroll100Count: 0,
            goalConversions: 0,
          };
          this.experimentEvidence.set(expEvidenceKey, expEv);
        }
        // Freeze each arm at its predeclared quota to avoid optional stopping.
        if (expEv.sessions >= Math.ceil(exp.minSampleSize / 2)) {
          agg.lastSeenAt = new Date().toISOString();
          return true;
        }
        expEv.sessions += 1;

        let sessionCtaTotal = 0;
        if (payload.ctaClicks) {
          for (const count of Object.values(payload.ctaClicks)) {
            sessionCtaTotal += count;
          }
        }
        expEv.ctaClicks += sessionCtaTotal;

        if (payload.scrollDepth.reached100) {
          expEv.scroll100Count += 1;
        }

        // Determine goal conversion for this session
        let isGoalConversion = false;
        if (exp.goal.type === "cta_click") {
          if (exp.goal.targetCtaId) {
            if ((payload.ctaClicks?.[exp.goal.targetCtaId] || 0) > 0) {
              isGoalConversion = true;
            }
          } else {
            if (sessionCtaTotal > 0) {
              isGoalConversion = true;
            }
          }
        } else if (exp.goal.type === "scroll_completion") {
          const thresh = exp.goal.thresholdScroll || 100;
          if (thresh === 100 && payload.scrollDepth.reached100) isGoalConversion = true;
          else if (thresh === 75 && payload.scrollDepth.reached75) isGoalConversion = true;
          else if (thresh === 50 && payload.scrollDepth.reached50) isGoalConversion = true;
          else if (thresh === 25 && payload.scrollDepth.reached25) isGoalConversion = true;
        }

        if (isGoalConversion) {
          expEv.goalConversions += 1;
        }
      }
    }

    agg.lastSeenAt = new Date().toISOString();
    return true;
  }

  /**
   * Creates a new UX Experiment from two published versions.
   */
  public createExperiment(req: CreateExperimentRequest): UXExperiment {
    if (!this.hasPublishedVersion(req.projectId, req.pageId, req.controlVersionId)) {
      throw new Error(`Control version '${req.controlVersionId}' is not published for this project/page.`);
    }
    if (!this.hasPublishedVersion(req.projectId, req.pageId, req.variantVersionId)) {
      throw new Error(`Variant version '${req.variantVersionId}' is not published for this project/page.`);
    }

    const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const experiment: UXExperiment = {
      id,
      projectId: req.projectId,
      pageId: req.pageId,
      name: req.name,
      controlVersionId: req.controlVersionId,
      variantVersionId: req.variantVersionId,
      status: "running",
      goal: {
        type: req.goal.type,
        targetCtaId: req.goal.targetCtaId,
        thresholdScroll: req.goal.thresholdScroll ?? 100,
      },
      trafficSplit: req.trafficSplit ?? 50,
      minSampleSize: req.minSampleSize ?? 20,
      confidenceThreshold: req.confidenceThreshold ?? 0.95,
      startedAt: new Date().toISOString(),
      endedAt: null,
      promotedVersionId: null,
    };

    this.experiments.set(id, experiment);
    this.experimentEvidence.set(`${id}::control`, {
      sessions: 0,
      ctaClicks: 0,
      scroll100Count: 0,
      goalConversions: 0,
    });
    this.experimentEvidence.set(`${id}::variant`, {
      sessions: 0,
      ctaClicks: 0,
      scroll100Count: 0,
      goalConversions: 0,
    });

    return experiment;
  }

  /**
   * Retrieves an experiment by ID.
   */
  public getExperiment(id: string): UXExperiment | null {
    return this.experiments.get(id) || null;
  }

  /**
   * Retrieves all experiments for a project.
   */
  public getExperimentsForProject(projectId: string): UXExperiment[] {
    const results: UXExperiment[] = [];
    for (const exp of this.experiments.values()) {
      if (exp.projectId === projectId) {
        results.push({ ...exp });
      }
    }
    return results;
  }

  /**
   * Evaluates statistical decisioning for an experiment.
   */
  public getExperimentEvaluation(experimentId: string): ExperimentEvaluationResult | null {
    const exp = this.experiments.get(experimentId);
    if (!exp) return null;

    const controlEv = this.experimentEvidence.get(`${exp.id}::control`) || {
      sessions: 0,
      ctaClicks: 0,
      scroll100Count: 0,
      goalConversions: 0,
    };
    const variantEv = this.experimentEvidence.get(`${exp.id}::variant`) || {
      sessions: 0,
      ctaClicks: 0,
      scroll100Count: 0,
      goalConversions: 0,
    };

    return evaluateExperiment(exp, controlEv, variantEv);
  }

  /**
   * Promotes the winning version of an experiment to the active published version.
   * Requires explicit confirmation.
   */
  public promoteWinner(experimentId: string, versionId: string): boolean {
    const exp = this.experiments.get(experimentId);
    if (!exp) return false;

    if (versionId !== exp.controlVersionId && versionId !== exp.variantVersionId) {
      throw new Error("Target versionId must match either control or variant version of this experiment.");
    }
    if (exp.status === "concluded") throw new Error("Experiment already concluded.");
    if (this.getExperimentEvaluation(experimentId)?.recommendedWinner !== versionId) {
      throw new Error("No statistically supported winner for this version. Result is inconclusive or insufficient data.");
    }

    exp.status = "concluded";
    exp.endedAt = new Date().toISOString();
    exp.promotedVersionId = versionId;

    this.activePublishedVersions.set(`${exp.projectId}::${exp.pageId}`, versionId);
    return true;
  }

  /**
   * Returns the currently active published version for a project and page.
   */
  public getActivePublishedVersion(projectId: string, pageId: string): string | null {
    return this.activePublishedVersions.get(`${projectId}::${pageId}`) || null;
  }

  /**
   * Returns aggregated production evidence for a given project.
   * Can be filtered by a specific versionId, or returns all versions for the project.
   */
  public getAggregatedEvidence(
    projectId: string,
    versionId?: string | null
  ): AggregatedProductionEvidence[] {
    const results: AggregatedProductionEvidence[] = [];

    for (const agg of this.aggregatedEvidence.values()) {
      if (agg.projectId === projectId) {
        if (!versionId || agg.versionId === versionId) {
          // Return a safe copy without any internal sensitive data
          results.push({ ...agg });
        }
      }
    }

    return results;
  }

  /**
   * Resets all store data for clean testing.
   */
  public resetForTesting(): void {
    this.publishedVersions.clear();
    this.aggregatedEvidence.clear();
    this.experiments.clear();
    this.experimentEvidence.clear();
    this.activePublishedVersions.clear();
  }
}

// Global singleton instance for Next.js API routes
declare global {
  var __proofui_production_store__: ProductionStore | undefined;
}

// During Next.js HMR an instance created by an older class shape can survive a
// module update. Reuse it only when it implements the current review contract;
// otherwise API routes would call missing methods and return 500 until restart.
const cachedProductionStore = globalThis.__proofui_production_store__;
export const productionStore: ProductionStore =
  cachedProductionStore &&
  typeof cachedProductionStore.getActivePublishedVersion === "function"
    ? cachedProductionStore
    : new ProductionStore();

globalThis.__proofui_production_store__ = productionStore;
