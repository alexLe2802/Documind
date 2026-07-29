import { Injectable } from '@nestjs/common';

export interface ExtractionQueueItem {
  jobId: string;
  documentId: string;
}

type ExtractionQueueProcessor = (item: ExtractionQueueItem) => Promise<void>;

@Injectable()
export class ExtractionQueueService {
  private readonly runningJobIds = new Set<string>();
  private processor?: ExtractionQueueProcessor;

  registerProcessor(processor: ExtractionQueueProcessor): void {
    this.processor = processor;
  }

  enqueue(item: ExtractionQueueItem): void {
    if (!this.processor || this.runningJobIds.has(item.jobId)) {
      return;
    }

    this.runningJobIds.add(item.jobId);
    void Promise.resolve()
      .then(() => this.processor?.(item))
      .catch(() => undefined)
      .finally(() => this.runningJobIds.delete(item.jobId));
  }
}
