import {
  PublishedMetadata,
  ProductionTelemetryPayload,
  AggregatedProductionEvidence,
  SessionDurationBucket,
} from "./schemas";
import { UXAnalysisViewport } from "../optimization/schemas";

interface PublishedRecord {
  metadata: PublishedMetadata;
  html: string;
}

export class ProductionStore {
  // Map key: `${projectId}::${pageId}::${versionId}`
  private publishedVersions: Map<string, PublishedRecord> = new Map();

  // Map key: `${projectId}::${versionId}`
  private aggregatedEvidence: Map<string, AggregatedProductionEvidence> = new Map();

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

    agg.lastSeenAt = new Date().toISOString();
    return true;
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
  }
}

// Global singleton instance for Next.js API routes
declare global {
  var __proofui_production_store__: ProductionStore | undefined;
}

export const productionStore: ProductionStore =
  globalThis.__proofui_production_store__ || new ProductionStore();

if (process.env.NODE_ENV !== "production") {
  globalThis.__proofui_production_store__ = productionStore;
}
