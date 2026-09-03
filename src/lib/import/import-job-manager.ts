import { CapturePackage } from "./schemas";
import { captureWebsite, CaptureRequest } from "./playwright-capture";

export type ImportJobStatus = "pending" | "capturing" | "completed" | "failed" | "canceled";

export interface ImportJob {
  id: string;
  url: string;
  status: ImportJobStatus;
  currentStage: string;
  progressPercent: number;
  result?: CapturePackage;
  error?: string;
  createdAt: number;
  updatedAt: number;
  abortController?: AbortController;
}

class ImportJobManager {
  private jobs = new Map<string, ImportJob>();

  createJob(url: string): ImportJob {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const job: ImportJob = {
      id,
      url,
      status: "pending",
      currentStage: "Validating URL",
      progressPercent: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      abortController: new AbortController(),
    };
    this.jobs.set(id, job);
    this.cleanupOldJobs();
    return job;
  }

  getJob(id: string): ImportJob | undefined {
    return this.jobs.get(id);
  }

  async startJob(jobId: string, request: CaptureRequest): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = "capturing";
    job.updatedAt = Date.now();

    try {
      const result = await captureWebsite(request, {
        onProgress: (stage, percent) => {
          job.currentStage = stage;
          job.progressPercent = percent;
          job.updatedAt = Date.now();
        },
        signal: job.abortController?.signal,
      });

      job.status = "completed";
      job.progressPercent = 100;
      job.currentStage = "Preparing review";
      job.result = result;
      job.updatedAt = Date.now();
    } catch (err) {
      if ((job.status as ImportJobStatus) !== "canceled") {
        job.status = "failed";
        job.error = err instanceof Error ? err.message : String(err);
        job.updatedAt = Date.now();
      }
    }
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.abortController) {
      job.abortController.abort();
    }
    job.status = "canceled";
    job.currentStage = "Canceled";
    job.updatedAt = Date.now();
    return true;
  }

  private cleanupOldJobs(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, job] of this.jobs.entries()) {
      if (job.createdAt < oneHourAgo) {
        this.jobs.delete(id);
      }
    }
  }
}

// Global singleton instance for development runtime
export const globalImportJobManager = new ImportJobManager();
