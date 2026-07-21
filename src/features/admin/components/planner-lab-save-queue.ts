export type PlannerLabSaveResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Serializuje autosave celého týdne. Při rychlých úpravách drží pouze poslední
 * požadovaný stav; starší odpověď proto nemůže přepsat novější optimistické UI.
 */
export class PlannerLabSaveQueue<T> {
  private saving = false;
  private queued: T | null = null;

  constructor(
    private readonly save: (value: T) => Promise<PlannerLabSaveResult>,
    private readonly onSavingChange: (saving: boolean) => void,
    private readonly onSaved: (value: T) => void,
    private readonly onError: (message: string) => void,
  ) {}

  enqueue(value: T) {
    this.queued = value;
    if (!this.saving) void this.flush();
  }

  private async flush() {
    this.saving = true;
    this.onSavingChange(true);

    while (this.queued) {
      const value = this.queued;
      this.queued = null;
      const result = await this.save(value);

      if (!result.ok) {
        this.queued = null;
        this.saving = false;
        this.onSavingChange(false);
        this.onError(result.message);
        return;
      }

      this.onSaved(value);
    }

    this.saving = false;
    this.onSavingChange(false);
  }
}
