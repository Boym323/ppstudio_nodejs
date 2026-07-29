export type PlannerLabSaveResult =
  | { ok: true; operationId?: string }
  | { ok: false; message: string };

/** Serializuje dílčí autosave změny v pořadí, v němž vznikly. */
export class PlannerLabSaveQueue<T> {
  private saving = false;
  private queued: T[] = [];

  constructor(
    private readonly save: (value: T) => Promise<PlannerLabSaveResult>,
    private readonly onSavingChange: (saving: boolean) => void,
    private readonly onSaved: (value: T, result: Extract<PlannerLabSaveResult, { ok: true }>) => void,
    private readonly onDrained: () => void,
    private readonly onError: (message: string) => void,
  ) {}

  enqueue(value: T) {
    this.queued.push(value);
    if (!this.saving) void this.flush();
  }

  retry() {
    if (this.queued.length > 0 && !this.saving) void this.flush();
  }

  discardPending() {
    if (!this.saving) this.queued = [];
  }

  private async flush() {
    this.saving = true;
    this.onSavingChange(true);

    while (this.queued.length > 0) {
      const value = this.queued[0];
      let result: PlannerLabSaveResult;

      try {
        result = await this.save(value);
      } catch {
        result = { ok: false, message: "Změnu dostupnosti se teď nepodařilo uložit." };
      }

      if (!result.ok) {
        this.saving = false;
        this.onSavingChange(false);
        this.onError(result.message);
        return;
      }

      this.queued.shift();
      this.onSaved(value, result);
    }

    this.saving = false;
    this.onSavingChange(false);
    this.onDrained();
  }
}
