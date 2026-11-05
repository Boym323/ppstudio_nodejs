# ADR 0121: Souhlas pro veřejné analytické a marketingové trackery

## Kontext

ADR 0120 dříve odstranilo kontrolu souhlasu. To je pro nepovinné analytické a marketingové identifikátory rizikové a neodpovídá požadavku na opt-in.

## Rozhodnutí

- Nezbytné cookies rezervací nejsou blokovány.
- `ppstudio-tracking-consent-v1` nese dvě samostatné hodnoty: `analytics` a `marketing`; bez platné volby jsou obě vypnuté.
- Meta Pixel a Google Ads vyžadují marketingový souhlas; Matomo a Clarity analytický souhlas.
- Serverové Meta CAPI `Schedule` vzniká v booking transakci jen s marketingovým souhlasem.
- Interní akviziční cookie UTM/MTM se ukládá jen s analytickým souhlasem, při jeho odebrání se maže.
- UI nabízí odmítnutí, souhlas s kategoriemi a přijetí všech; změna nastavení je dostupná z patičky. Při odvolání již uděleného souhlasu se stránka obnoví, aby nedobíhaly již načtené skripty.
- Vypnutí CAPI v konfiguraci ponechává existující čekající outbox události, dojde ale k jejich expiraci po šesti dnech.

## Ověření

Jednotkové testy kontrolují nezávislou volbu kategorií a chování pixelových/analytických funkcí bez souhlasu. E2E ověřuje, že se skripty nenačtou před souhlasem, a DB integrační test chrání čekající CAPI události při vypnutí konfigurace.

## Stav

schváleno pro vývoj; nahrazuje ADR 0120. Před produkčním nasazením je nutné aktualizovat zásady cookies a ověřit právní soulad.
