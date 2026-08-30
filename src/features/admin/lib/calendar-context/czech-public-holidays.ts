import {
  addDays,
  formatDateKey,
  getDayBounds,
  isValidDateKey,
} from "@/features/admin/lib/admin-slots/time";

export type CzechHoliday = Readonly<{
  date: string;
  name: string;
}>;

const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: "Nový rok / Den obnovy samostatného českého státu" },
  { month: 5, day: 1, name: "Svátek práce" },
  { month: 5, day: 8, name: "Den vítězství" },
  { month: 7, day: 5, name: "Den slovanských věrozvěstů Cyrila a Metoděje" },
  { month: 7, day: 6, name: "Den upálení mistra Jana Husa" },
  { month: 9, day: 28, name: "Den české státnosti" },
  { month: 10, day: 28, name: "Den vzniku samostatného československého státu" },
  { month: 11, day: 17, name: "Den boje za svobodu a demokracii a Mezinárodní den studentstva" },
  { month: 12, day: 24, name: "Štědrý den" },
  { month: 12, day: 25, name: "1. svátek vánoční" },
  { month: 12, day: 26, name: "2. svátek vánoční" },
] as const;

const holidaysByYear = new Map<number, readonly CzechHoliday[]>();

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftDateKey(dateKey: string, amount: number) {
  return formatDateKey(addDays(getDayBounds(dateKey).startsAt, amount));
}

/**
 * Deterministický gregoriánský výpočet data Velikonoční neděle.
 * Algoritmus je vhodný pro roky 1–9999, které podporuje dateKey utility.
 */
export function calculateEasterSundayDateKey(year: number) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    throw new RangeError("Rok Velikonoc musí být celé číslo od 1 do 9999.");
  }

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return dateKeyFromParts(year, month, day);
}

/**
 * Lokální seznam státních a ostatních svátků podle zákona č. 245/2000 Sb.
 * Zdroj: https://e-sbirka.gov.cz/sb/2000/245
 * Významné dny, které nejsou dny pracovního klidu, záměrně nejsou zahrnuty.
 */
export function getCzechPublicHolidays(year: number): readonly CzechHoliday[] {
  const cached = holidaysByYear.get(year);

  if (cached) {
    return cached;
  }

  const easterSunday = calculateEasterSundayDateKey(year);
  const holidays = [
    ...FIXED_HOLIDAYS.map(({ month, day, name }) => ({
      date: dateKeyFromParts(year, month, day),
      name,
    })),
    { date: shiftDateKey(easterSunday, -2), name: "Velký pátek" },
    { date: shiftDateKey(easterSunday, 1), name: "Velikonoční pondělí" },
  ] as const;

  holidaysByYear.set(year, holidays);
  return holidays;
}

export function getCzechPublicHoliday(dateKey: string): CzechHoliday | null {
  if (!isValidDateKey(dateKey)) {
    return null;
  }

  const year = Number(dateKey.slice(0, 4));
  return getCzechPublicHolidays(year).find((holiday) => holiday.date === dateKey) ?? null;
}
