export const DOCUMENT_DELIVERY_RETRY_MS = [750, 2500] as const;
export const DOCUMENT_DELIVERY_FAILURE_MS = 5000;

export interface DocumentDeliveryIdentity {
  revision: number;
  payloadHash: string;
}

export interface DocumentDeliveryClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const systemClock: DocumentDeliveryClock = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: handle => clearTimeout(handle as NodeJS.Timeout),
};

/** One bounded, idempotent delivery budget with exact receipt matching. */
export class DocumentDeliverySchedule {
  private handles: unknown[] = [];
  private active = false;

  constructor(
    readonly identity: DocumentDeliveryIdentity,
    private readonly onRetry: (attempt: 2 | 3) => void,
    private readonly onExhausted: () => void,
    private readonly clock: DocumentDeliveryClock = systemClock,
  ) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.handles = [
      this.clock.setTimeout(() => this.retry(2), DOCUMENT_DELIVERY_RETRY_MS[0]),
      this.clock.setTimeout(() => this.retry(3), DOCUMENT_DELIVERY_RETRY_MS[1]),
      this.clock.setTimeout(() => this.exhaust(), DOCUMENT_DELIVERY_FAILURE_MS),
    ];
  }

  matches(receipt: DocumentDeliveryIdentity): boolean {
    return this.active
      && receipt.revision === this.identity.revision
      && receipt.payloadHash === this.identity.payloadHash;
  }

  acknowledge(receipt: DocumentDeliveryIdentity): boolean {
    if (!this.matches(receipt)) return false;
    this.cancel();
    return true;
  }

  cancel(): void {
    if (!this.active) return;
    this.active = false;
    for (const handle of this.handles) this.clock.clearTimeout(handle);
    this.handles = [];
  }

  private retry(attempt: 2 | 3): void {
    if (this.active) this.onRetry(attempt);
  }

  private exhaust(): void {
    if (!this.active) return;
    this.active = false;
    this.handles = [];
    this.onExhausted();
  }
}
