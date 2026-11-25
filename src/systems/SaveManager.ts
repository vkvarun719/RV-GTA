import type { SaveData } from '../types/game';

const STORAGE_KEY = 'namma-rvitm-save-v1';

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  cash: 500,
  completedMissions: [],
  gigsCompleted: 0,
  chaiBought: 0,
  graphicsQuality: 'high',
  weatherOverride: 'auto',
  radioEnabled: false,
  totalDistanceM: 0,
};

export class SaveManager {
  public data: SaveData;

  constructor() {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAVE };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota errors
    }
  }

  exportJson(): string {
    const json = JSON.stringify(this.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `namma-rvitm-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return json;
  }

  importJson(jsonText: string): boolean {
    try {
      const parsed = JSON.parse(jsonText) as Partial<SaveData>;
      if (typeof parsed.cash !== 'number') return false;
      this.data = {
        ...DEFAULT_SAVE,
        ...parsed,
        completedMissions: Array.isArray(parsed.completedMissions) ? parsed.completedMissions : [],
      };
      this.save();
      return true;
    } catch {
      return false;
    }
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE };
    this.save();
  }
}
