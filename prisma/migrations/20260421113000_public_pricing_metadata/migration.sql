-- Create enums for pricing presentation metadata
CREATE TYPE "PricingLayout" AS ENUM ('LIST', 'GRID');
CREATE TYPE "PricingIconKey" AS ENUM ('DROPLET', 'EYE_LASHES', 'LOTUS', 'BRUSH', 'LEAF', 'LIPSTICK', 'SPARK');

-- Extend categories with public pricing metadata
ALTER TABLE "ServiceCategory"
  ADD COLUMN "publicName" TEXT,
  ADD COLUMN "pricingDescription" TEXT,
  ADD COLUMN "pricingLayout" "PricingLayout" NOT NULL DEFAULT 'GRID',
  ADD COLUMN "pricingIconKey" "PricingIconKey" NOT NULL DEFAULT 'SPARK',
  ADD COLUMN "pricingSortOrder" INTEGER NOT NULL DEFAULT 0;

-- Extend services with public presentation metadata
ALTER TABLE "Service"
  ADD COLUMN "publicName" TEXT,
  ADD COLUMN "publicIntro" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "pricingShortDescription" TEXT,
  ADD COLUMN "pricingBadge" TEXT;

CREATE INDEX "ServiceCategory_isActive_pricingSortOrder_idx" ON "ServiceCategory"("isActive", "pricingSortOrder");

-- Backfill category pricing metadata from the current public site mapping
UPDATE "ServiceCategory"
SET
  "publicName" = "name",
  "pricingDescription" = COALESCE("description", 'Přehled služeb v této kategorii.'),
  "pricingLayout" = 'GRID',
  "pricingIconKey" = 'SPARK',
  "pricingSortOrder" = "sortOrder"
WHERE "publicName" IS NULL;

UPDATE "ServiceCategory"
SET
  "publicName" = 'Kosmetické ošetření',
  "pricingDescription" = 'Ošetření pro pleť, která potřebuje vyčistit, zklidnit a vrátit do rovnováhy. Vhodné pro pravidelnou péči i jako jistý začátek.',
  "pricingLayout" = 'LIST',
  "pricingIconKey" = 'DROPLET',
  "pricingSortOrder" = 10
WHERE "name" = 'Kosmetické ošetření';

UPDATE "ServiceCategory"
SET
  "publicName" = 'Řasy a obočí',
  "pricingDescription" = 'Služby pro výraznější pohled a upravený rám obličeje.',
  "pricingLayout" = 'GRID',
  "pricingIconKey" = 'EYE_LASHES',
  "pricingSortOrder" = 20
WHERE "name" = 'Lash & brow bar';

UPDATE "ServiceCategory"
SET
  "publicName" = 'Masáže',
  "pricingDescription" = 'Uvolnění napětí, odlehčení obličeje a podpora regenerace.',
  "pricingLayout" = 'GRID',
  "pricingIconKey" = 'LOTUS',
  "pricingSortOrder" = 30
WHERE "name" = 'Masáže';

UPDATE "ServiceCategory"
SET
  "publicName" = 'Barvení a úprava',
  "pricingDescription" = 'Drobné služby, které dodají obličeji definici.',
  "pricingLayout" = 'GRID',
  "pricingIconKey" = 'BRUSH',
  "pricingSortOrder" = 40
WHERE "name" = 'Úprava řas a obočí';

UPDATE "ServiceCategory"
SET
  "publicName" = 'Depilace',
  "pricingDescription" = 'Šetrná úprava pro čistší a hladší vzhled.',
  "pricingLayout" = 'GRID',
  "pricingIconKey" = 'LEAF',
  "pricingSortOrder" = 50
WHERE "name" = 'Depilace';

UPDATE "ServiceCategory"
SET
  "publicName" = 'Líčení',
  "pricingDescription" = 'Líčení na každý den i výjimečné příležitosti.',
  "pricingLayout" = 'LIST',
  "pricingIconKey" = 'LIPSTICK',
  "pricingSortOrder" = 60
WHERE "name" = 'Vizážistika a líčení';

-- Backfill service public content metadata from the current public service mapping
UPDATE "Service"
SET
  "publicName" = "name",
  "publicIntro" = COALESCE("shortDescription", "description"),
  "seoDescription" = COALESCE("shortDescription", "description"),
  "pricingShortDescription" = COALESCE("shortDescription", "description")
WHERE "publicName" IS NULL;

UPDATE "Service" SET "publicName" = 'Refresh ošetření pleti', "publicIntro" = 'Ošetření pro pleť, která potřebuje vyčistit, zklidnit a vrátit do rovnováhy. Vhodné pro pravidelnou péči i jako jistý začátek.', "seoDescription" = 'Refresh ošetření pleti pro vyčištění, zklidnění a podporu rovnováhy pleti.', "pricingShortDescription" = 'Jemné základní ošetření vhodné i jako první návštěva.', "pricingBadge" = 'PRO PRVNÍ NÁVŠTĚVU' WHERE "slug" = 'refresh-treatment-60-min';
UPDATE "Service" SET "publicName" = 'Refresh ošetření pleti s masáží', "publicIntro" = 'Delší verze ošetření s větším prostorem pro komfort i péči o pleť. Ideální, když chcete spojit účinek ošetření s uvolněnějším průběhem.', "seoDescription" = 'Delší refresh ošetření pleti s masáží pro komfortnější průběh a vyváženou péči.', "pricingShortDescription" = 'Více prostoru pro komfort a uvolnění.', "pricingBadge" = 'DELŠÍ VARIANTA' WHERE "slug" = 'refresh-treatment-90-min';
UPDATE "Service" SET "publicName" = 'Anti-age ošetření', "publicIntro" = 'Péče pro pleť, která potřebuje podpořit pevnost, výživu a celkovou kondici. Výsledkem je kultivovanější a odpočatější vzhled.', "seoDescription" = 'Anti-age ošetření pro podporu pevnosti, výživy a celkové kondice pleti.', "pricingShortDescription" = 'Podpora pevnosti, výživy a celkové kondice pleti.', "pricingBadge" = 'CÍLENĚJŠÍ PÉČE' WHERE "slug" = 'anti-age-treatment';
UPDATE "Service" SET "publicName" = 'Clear ošetření pleti', "publicIntro" = 'Ošetření pro pleť se sklonem k nečistotám, přetížení nebo nerovnováze. Pomáhá ji pročistit a vrátit jí větší komfort.', "seoDescription" = 'Clear ošetření pleti pro pleť se sklonem k nečistotám a narušené rovnováze.', "pricingShortDescription" = 'Pro pleť se sklonem k nečistotám a nerovnováze.' WHERE "slug" = 'clear-treatment';
UPDATE "Service" SET "publicName" = 'Pánské ošetření pleti', "publicIntro" = 'Prakticky vedené ošetření zaměřené na čistotu pleti, pohodlí a upravený výsledek. Dobrá volba pro pravidelnou péči i první návštěvu.', "seoDescription" = 'Pánské ošetření pleti zaměřené na čistotu, komfort a pravidelnou péči.', "pricingShortDescription" = 'Praktická péče pro čistou, svěží a upravenou pleť.' WHERE "slug" = 'mens-treatment';
UPDATE "Service" SET "publicName" = 'Spicule & PDRN ošetření', "publicIntro" = 'Intenzivnější péče pro pleť, která potřebuje podpořit obnovu a dodat novou energii. Vhodné ve chvíli, kdy chcete cílenější zásah.', "seoDescription" = 'Spicule & PDRN ošetření pro podporu obnovy pleti a cílenější péči.', "pricingShortDescription" = 'Intenzivní péče pro obnovu a novou energii pleti.', "pricingBadge" = 'INTENZIVNÍ PÉČE' WHERE "slug" = 'spicule-pdrn-treatment';
UPDATE "Service" SET "publicName" = 'Studentské ošetření pleti', "publicIntro" = 'Ošetření pro mladou pleť se zaměřením na čistotu, rovnováhu a správné návyky v péči. Citlivě vedený začátek bez zbytečné složitosti.', "seoDescription" = 'Studentské ošetření pleti pro mladou pleť a správné návyky v péči.', "pricingShortDescription" = 'Péče pro mladou pleť se zaměřením na čistotu a rovnováhu.' WHERE "slug" = 'student-treatment-15-20-let';
UPDATE "Service" SET "publicName" = 'Spicule & Exosomy ošetření', "publicIntro" = 'Cílená péče pro pleť, která si žádá regeneraci a podporu celkové kondice. Ošetření je vhodné, když chcete pleti dopřát víc než běžný standard.', "seoDescription" = 'Spicule & Exosomy ošetření pro regeneraci a podporu celkové kondice pleti.', "pricingShortDescription" = 'Cílená péče pro regeneraci a podporu kondice pleti.', "pricingBadge" = 'REGENERACE' WHERE "slug" = 'spicule-exosomy-treatment';
UPDATE "Service" SET "publicName" = 'Lash lifting řas', "publicIntro" = 'Služba, která otevře pohled a dodá řasám výraznější linii bez každodenní práce s řasenkou. Výsledný efekt působí čistě a uspořádaně.', "seoDescription" = 'Lash lifting řas pro otevřenější pohled a výraznější linii přírodních řas.', "pricingShortDescription" = 'Výraznější linie řas a otevřenější pohled bez řasenky.' WHERE "slug" = 'lash-lifting';
UPDATE "Service" SET "publicName" = 'Laminace obočí', "publicIntro" = 'Úprava pro obočí, které potřebuje tvar, směr a lepší disciplínu. Pomáhá vytvořit upravený rám obličeje.', "seoDescription" = 'Laminace obočí pro lepší tvar, směr a upravený rám obličeje.', "pricingShortDescription" = 'Úprava pro disciplinovanější tvar a upravený rám obličeje.' WHERE "slug" = 'laminace-oboci';
UPDATE "Service" SET "publicName" = 'Lash lifting a laminace obočí', "publicIntro" = 'Kombinace pro ženy, které chtějí sladit obočí i řasy v jednom kroku. Pohled je výraznější a obličej působí uceleněji.', "seoDescription" = 'Kombinace lash liftingu a laminace obočí pro sjednocený výraz očí a obličeje.', "pricingShortDescription" = 'Kombinace pro sjednocený výraz očí i obočí.' WHERE "slug" = 'lash-lifting-plus-laminace-oboci';
UPDATE "Service" SET "publicName" = 'Lymfatická masáž obličeje', "publicIntro" = 'Masáž pro odlehčení obličeje, uvolnění napětí a podporu regenerace. Vhodná, když potřebujete zpomalit a dopřát si pečující reset.', "seoDescription" = 'Lymfatická masáž obličeje pro odlehčení, uvolnění a podporu regenerace.', "pricingShortDescription" = 'Klidná masáž pro odlehčení obličeje a jemné uvolnění.' WHERE "slug" = 'lymfaticka-masaz-obliceje';
UPDATE "Service" SET "publicName" = 'Barvení obočí', "publicIntro" = 'Rychlá služba pro plnější a čitelnější tvar obočí. Hodí se, když chcete dodat obličeji větší definici.', "seoDescription" = 'Barvení obočí pro plnější tvar a výraznější rám obličeje.', "pricingShortDescription" = 'Rychlá úprava pro plnější a čitelnější tvar obočí.' WHERE "slug" = 'barveni-oboci';
UPDATE "Service" SET "publicName" = 'Barvení řas', "publicIntro" = 'Zvýraznění řas pro otevřenější pohled i bez líčení. Praktická volba pro každodenní pohodlí.', "seoDescription" = 'Barvení řas pro otevřenější pohled a pohodlnější každodenní úpravu.', "pricingShortDescription" = 'Zvýraznění řas pro otevřenější pohled i bez líčení.' WHERE "slug" = 'barveni-ras';
UPDATE "Service" SET "publicName" = 'Úprava obočí', "publicIntro" = 'Precizní úprava tvaru obočí, která pomáhá vyvážit výraz obličeje. Malý detail s velmi viditelným efektem.', "seoDescription" = 'Úprava obočí pro vyváženější výraz obličeje a čistou linii.', "pricingShortDescription" = 'Precizní úprava tvaru obočí pro čistší linii.' WHERE "slug" = 'uprava-oboci';
UPDATE "Service" SET "publicName" = 'Depilace horního rtu a brady', "publicIntro" = 'Šetrná úprava drobných partií obličeje pro čistší a hladší vzhled. Vhodná samostatně i jako doplněk k jiné službě.', "seoDescription" = 'Depilace horního rtu a brady pro hladší a čistší vzhled obličeje.', "pricingShortDescription" = 'Šetrná úprava drobných partií obličeje.' WHERE "slug" = 'depilace-horniho-rtu-brady';
UPDATE "Service" SET "publicName" = 'Depilace vybraných partií obličeje', "publicIntro" = 'Úprava menších oblastí podle individuální potřeby. Pomáhá dotáhnout celkový dojem do čistého výsledku.', "seoDescription" = 'Depilace vybraných partií obličeje podle individuální potřeby.', "pricingShortDescription" = 'Úprava menších oblastí podle individuální potřeby.' WHERE "slug" = 'depilace-periferii';
UPDATE "Service" SET "publicName" = 'Depilace celých nohou', "publicIntro" = 'Služba pro hladký vzhled nohou a příjemný pocit lehkosti. Praktická volba pro pravidelnou péči.', "seoDescription" = 'Depilace celých nohou pro hladký vzhled a pravidelnou péči.', "pricingShortDescription" = 'Praktická péče pro hladký vzhled a lehký pocit.' WHERE "slug" = 'depilace-cele-nohy';
UPDATE "Service" SET "publicName" = 'Depilace rukou', "publicIntro" = 'Jemná úprava pro hladší vzhled pokožky rukou. Vhodná pro ženy, které chtějí čistý a pěstěný výsledek.', "seoDescription" = 'Depilace rukou pro hladší vzhled a pěstěný výsledek.', "pricingShortDescription" = 'Jemná úprava pro hladší a pěstěný vzhled rukou.' WHERE "slug" = 'depilace-ruce';
UPDATE "Service" SET "publicName" = 'Denní líčení', "publicIntro" = 'Lehký styl líčení pro den, práci nebo schůzku, kdy chcete působit upraveně a sebejistě. Výsledný look zůstává čistý a dobře nositelný.', "seoDescription" = 'Denní líčení pro práci, schůzku nebo běžný den s čistým a nositelným výsledkem.', "pricingShortDescription" = 'Lehký styl líčení pro práci, schůzku nebo běžný den.' WHERE "slug" = 'denni-liceni';
UPDATE "Service" SET "publicName" = 'Večerní a společenské líčení', "publicIntro" = 'Líčení pro události, kde má vzhled větší roli a prostor pro osobitější styl. Přizpůsobím ho příležitosti i tomu, v čem se cítíte dobře.', "seoDescription" = 'Večerní a společenské líčení přizpůsobené příležitosti i osobnímu stylu.', "pricingShortDescription" = 'Líčení pro večer, společenské události a slavnostní chvíle.' WHERE "slug" = 'vecerni-spolecenske-liceni';
