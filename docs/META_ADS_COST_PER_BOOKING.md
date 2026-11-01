# Meta Ads – automatická cena za rezervaci

## Co funkce počítá

Administrace **Statistiky** automaticky načte agregovanou útratu z Meta Marketing API v26.0 (Insights, `level=account`) a spočítá cenu za aktivní rezervaci a cenu za dokončenou návštěvu.

- **Útrata:** všechny reklamy vybraného Meta reklamního účtu za vybrané období; částky v měně samotného účtu, nikoli automaticky v CZK.
- **Počet rezervací:** webové rezervace **vytvořené** ve stejném období se zdrojem FACEBOOK/INSTAGRAM a prokazatelně placeným médiem (např. `paid_social`). Počítají se PENDING, CONFIRMED a COMPLETED.
- **Cena za rezervaci:** útrata / aktivní rezervace. Pokud nejsou žádné, ukazuje se `—`, nikoli 0 Kč.
- **Cena za dokončenou návštěvu:** útrata / rezervace z této kohorty ve stavu COMPLETED. U čerstvých rezervací se může v budoucnu měnit.
- Proti ostatním provozním KPI, které používají plánovaný termín návštěvy (`scheduledStartsAt`), tento report záměrně používá datum vytvoření (`createdAt`).
- Report není Meta Ads Manager atribuce: nedokáže přiřadit zprávy v Messengeru, rezervace bez označených odkazů, telefonické rezervace ani reklamu, která nevede na web. Rozpočet zahrnuje i jiné kampaně reklamního účtu.

## Jednorázové zprovoznění v Meta Business

1. Zjisti **ID reklamního účtu** v Meta Ads Manageru. V URL bývá za `act=` (do .env zadej jen číslo bez `act_`).
2. V [Meta for Developers](https://developers.facebook.com/apps/) vytvoř / použij aplikaci propojenou se stejným Business portfoliem a s přístupem k Marketing API.
3. V Meta Business Settings → Users → System users založ systémového uživatele; přiděl mu právo *View performance* k příslušnému reklamnímu účtu. Vygeneruj token pro danou aplikaci s `ads_read`. Nepovoluj `ads_management`, protože integrace reklamy pouze čte. Pokud Meta požaduje další business práva nebo ověření, postupuj podle požadavků konkrétního účtu.
4. Na serveru, mimo GitHub a mimo veřejný JS bundle, nastav:
   ```dotenv
   META_ADS_ACCOUNT_ID=123456789012345
   META_ADS_ACCESS_TOKEN=<tajny-token-system-user>
   ```
5. Restartuj webovou službu standardním release postupem, aby načetla nové proměnné. Otevři přihlášenou stránku `/admin/statistiky` (nebo provozní variantu).
6. Zkontroluj, že útrata a měna přibližně odpovídají Meta Ads Manageru při stejném datovém období a účtu. Počítej s časovým zpožděním API / cache (až 1 hodina).

Token nikdy nezadávej do chatu, nepřidávej do repozitáře, CI logů, query parametrů ani hodnot `NEXT_PUBLIC_*`. Přístupový token může mít omezenou platnost; pokud skončí, systém zobrazí chybový stav místo falešného reportu.

## Označování Meta reklam

Každá reklama vedoucí na web by měla mít nastavené **URL parameters** v Ads Manageru, například:

```text
mtm_source={{site_source_name}}&mtm_medium=paid_social&mtm_campaign={{campaign.id}}&mtm_content={{ad.id}}&mtm_placement={{placement}}
```

Používej URL parametrické pole reklamy, ne pevné přepisování cílových URL. Dynamické hodnoty ověř pomocí náhledu konkrétní reklamy – `site_source_name` vrací zdroj Facebook/Instagram. V současné databázi se ukládají `mtm_source`, `mtm_medium`, `mtm_campaign` (do `acquisitionUtm*`); `mtm_content` a `mtm_placement` v databázi zatím nejsou, a proto nejsou součástí tohoto MVP.

**Pozor na historická data:** starší reklamy bez `paid_social` zůstávají záměrně mimo denominator. Organický Instagram se nesmí vydávat za placenou reklamu.

## Provoz a bezpečnost

- Server fetch na `https://graph.facebook.com/v26.0/act_{id}/insights` používá hlavičku `Authorization: Bearer`, nikoli token v URL.
- Next fetch cache má `revalidate: 3600` (na novém období je samostatný cache klíč).
- Read-only reporting se počítá při otevření Statistik. Není potřeba cron ani ukládat marketingové výsledky do databáze.
- Chyba Meta API nikdy nesmí zablokovat samotnou administraci, objednávky ani provozní KPI.
- Bez konfigurace je integrace vypnutá. Žádná část klientského kódu se k Meta API nepřipojuje.
- Provozní report je viditelný pouze v již chráněných admin Statistikách.
- Unit test: `node --import tsx --test src/features/admin/lib/meta-ads-cost.test.ts`, následně `npm run typecheck`, lint a standardní CI testy.

## Další fáze (samostatně)

Pokud chceš CPA až na jednotlivé kampaně, rozšiř Insights na `level=campaign` a spoj `campaign_id` s ukládaným `mtm_campaign={{campaign.id}}`. Nepřičítej k úspěšným kampaním jen jejich útratu; musíš zahrnout i výdaje kampaní bez rezervací. Pro atribuci zpráv, telefonu nebo cross-device je potřeba zvláštní workflow, nikoli odhad na základě všech návštěv Instagramu.
