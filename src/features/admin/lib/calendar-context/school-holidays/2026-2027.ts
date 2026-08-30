import type { SchoolHolidayPeriod } from "../calendar-context";

// Školní rok 2026/2027. Zdroj MŠMT:
// https://msmt.gov.cz/vzdelavani/organizace-roku/organizace-skolniho-roku-2026-2027-v-zs-ss-zus-a-konzervatorich
// Data jsou ručně ověřená proti oficiálnímu MŠMT.
export const SCHOOL_HOLIDAYS_2026_2027: readonly SchoolHolidayPeriod[] = [
  { startDate: "2026-10-29", endDate: "2026-10-30", name: "Podzimní prázdniny" },
  { startDate: "2026-12-23", endDate: "2027-01-03", name: "Vánoční prázdniny" },
  { startDate: "2027-01-29", endDate: "2027-01-29", name: "Pololetní prázdniny" },
  { startDate: "2027-03-08", endDate: "2027-03-14", name: "Jarní prázdniny" },
  { startDate: "2027-03-25", endDate: "2027-03-25", name: "Velikonoční prázdniny" },
  { startDate: "2027-07-01", endDate: "2027-08-31", name: "Hlavní prázdniny" },
];
