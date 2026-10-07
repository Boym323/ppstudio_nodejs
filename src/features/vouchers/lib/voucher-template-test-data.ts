export const VOUCHER_TEMPLATE_TEST_DATA = {
  valueCzk: 1500,
  value: "1 500 Kč",
  service: {
    normal: "Korejský lash lifting",
    long: "ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ",
  },
  validUntilIso: "2027-12-31T22:59:59.999Z",
  validity: "31. 12. 2027",
  code: "TEST-2026-ABCDEF",
} as const;

// Shared by the editor and publication so a normal preview cannot hide a
// layout that fails the publication text checks.
export const VOUCHER_TEMPLATE_PUBLISH_SERVICE_NAMES = [
  "Korejský Lash lifting",
  "Velmi dlouhý název služby s českou diakritikou pro ověření zalomení a minimální velikosti písma",
] as const;
