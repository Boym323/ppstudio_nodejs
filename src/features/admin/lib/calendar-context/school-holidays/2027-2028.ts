import type { SchoolHolidayPeriod } from "../calendar-context";

// Školní rok 2027/2028, okres Zlín. Zdroj MŠMT:
// https://msmt.gov.cz/vzdelavani/organizace-roku/organizace-skolniho-roku-2027-2028-v-zs-ss-zus-a-konzervatorich
// Data jsou ručně ověřená proti oficiálnímu MŠMT.
export const SCHOOL_HOLIDAYS_2027_2028: readonly SchoolHolidayPeriod[] = [
  // 28. 10. je státní svátek, proto jsou podzimní prázdniny dvě oddělená data.
  { startDate: "2027-10-27", endDate: "2027-10-27", name: "Podzimní prázdniny" },
  { startDate: "2027-10-29", endDate: "2027-10-29", name: "Podzimní prázdniny" },
  { startDate: "2027-12-23", endDate: "2028-01-02", name: "Vánoční prázdniny" },
  { startDate: "2028-02-04", endDate: "2028-02-04", name: "Pololetní prázdniny" },
  { startDate: "2028-02-07", endDate: "2028-02-13", name: "Jarní prázdniny" },
  { startDate: "2028-04-13", endDate: "2028-04-13", name: "Velikonoční prázdniny" },
  { startDate: "2028-07-01", endDate: "2028-09-03", name: "Hlavní prázdniny" },
];
