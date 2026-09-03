import { ExtractionEvidence } from "./schemas";

export class EvidenceTracker {
  private evidenceList: ExtractionEvidence[] = [];
  private counter = 0;

  add(entry: Omit<ExtractionEvidence, "id">): string {
    this.counter++;
    const id = `ev_${this.counter}`;
    const evidence: ExtractionEvidence = {
      id,
      ...entry,
    };
    this.evidenceList.push(evidence);
    return id;
  }

  getAll(): ExtractionEvidence[] {
    return [...this.evidenceList];
  }

  getByCategory(category: ExtractionEvidence["category"]): ExtractionEvidence[] {
    return this.evidenceList.filter((e) => e.category === category);
  }
}
