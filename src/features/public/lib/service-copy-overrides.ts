export type ServiceCopyOverride = {
  cardIntro: string;
  detailIntro: string;
  idealFor: string[];
  includes: string[];
  results: string[];
  goodToKnow: string[];
  seoTitle: string;
  seoDescription: string;
};

// Dočasný migrační zdroj pro backfill DB polí služeb. Veřejný web má jako zdroj pravdy
// používat databázi a běžná editace copy patří do adminu, ne do této vrstvy.
export const serviceCopyOverrides: Record<string, ServiceCopyOverride> = {
  "refresh-treatment-60-min": {
    cardIntro: "Základní kosmetické ošetření pro čistší, klidnější a svěžejší vzhled pleti.",
    detailIntro:
      "Refresh Treatment je vhodný, když pleť působí unaveně, zaneseně nebo ztrácí komfort. Ošetření kombinuje šetrné čištění, péči podle aktuálního stavu pleti a závěrečné zklidnění.",
    idealFor: [
      "normální až smíšenou pleť",
      "první návštěvu kosmetiky",
      "pleť, která potřebuje vyčistit a osvěžit",
      "pocit zašedlé nebo přetížené pleti",
    ],
    includes: [
      "krátké zhodnocení aktuálního stavu pleti",
      "odlíčení, čištění a peeling",
      "šetrné dočištění pleti",
      "sérum, masku a závěrečnou péči",
      "podle domluvy úpravu řas nebo obočí",
    ],
    results: [
      "čistší a svěžejší vzhled pleti",
      "větší pocit komfortu bez zbytečného podráždění",
      "lepší orientaci v tom, jak o pleť dál pečovat",
    ],
    goodToKnow: [
      "v den ošetření je vhodné pleť zbytečně nedráždit",
      "po ošetření doporučuji lehčí režim a šetrnou domácí péči",
      "pokud máte citlivou pleť, alergie nebo aktivní podráždění, řekněte to předem",
    ],
    seoTitle: "Refresh kosmetické ošetření Zlín",
    seoDescription:
      "Refresh ošetření pleti v PP Studiu Zlín pro šetrné čištění, zklidnění a svěžejší vzhled pleti podle aktuální potřeby.",
  },
  "refresh-treatment-90-min": {
    cardIntro: "Delší varianta ošetření pleti s masáží pro větší komfort a uvolnění.",
    detailIntro:
      "Delší Refresh Treatment nabízí více času na péči o pleť i relaxační část. Hodí se, když chcete spojit čištění a zklidnění pleti s příjemnější, pomalejší návštěvou.",
    idealFor: [
      "normální až smíšenou pleť",
      "klientky, které chtějí kosmetiku i s masáží",
      "pleť, která potřebuje péči bez spěchu",
      "pravidelnou udržovací návštěvu",
    ],
    includes: [
      "zhodnocení pleti a výběr vhodného postupu",
      "čištění, peeling a šetrné dočištění",
      "sérum, masku a závěrečnou péči",
      "masáž obličeje, krku a dekoltu",
      "podle domluvy barvení řas nebo obočí",
    ],
    results: [
      "čistší, klidnější a opečovanější pleť",
      "uvolněnější pocit v obličeji a dekoltu",
      "svěžejší vzhled bez přehnaných slibů",
    ],
    goodToKnow: [
      "ideální volba, pokud chcete delší a klidnější průběh",
      "po ošetření se hodí vyhnout se výraznému zatížení pleti",
      "make-up doporučuji nanášet až s odstupem podle reakce pleti",
    ],
    seoTitle: "Refresh ošetření pleti s masáží Zlín",
    seoDescription:
      "Delší Refresh ošetření v PP Studiu Zlín kombinuje čištění pleti, masku, závěrečnou péči a masáž obličeje.",
  },
  "anti-age-treatment": {
    cardIntro: "Výživnější ošetření pro zralejší pleť, která potřebuje komfort, jas a péči.",
    detailIntro:
      "Anti Age Treatment je zaměřený na zralejší pleť, která může působit unaveně, suše nebo méně pružně. Cílem je dodat pleti péči, výživu a příjemný pocit bez nerealistických slibů.",
    idealFor: [
      "zralejší pleť přibližně 45+",
      "pocit suchosti, únavy nebo ztráty jasu",
      "klientky, které chtějí pečující a pomalejší ošetření",
      "pravidelnou podporu komfortu pleti",
    ],
    includes: [
      "úvodní zhodnocení pleti",
      "povrchové čištění a přípravu pleti",
      "masáž obličeje, krku a dekoltu",
      "aktivní péči, masku a závěrečný krém",
      "podle domluvy barvení řas nebo obočí",
    ],
    results: [
      "výživnější a opečovanější pocit pleti",
      "svěžejší a odpočatější vzhled",
      "větší komfort pleti po ošetření",
    ],
    goodToKnow: [
      "ošetření nenahrazuje dermatologickou péči",
      "výsledek je individuální podle stavu pleti",
      "pro stabilnější efekt dává smysl pravidelnost",
    ],
    seoTitle: "Anti age kosmetické ošetření Zlín",
    seoDescription:
      "Anti age ošetření v PP Studiu Zlín pro zralejší pleť, výživu, komfort a svěžejší vzhled bez přehnaných slibů.",
  },
  "clear-treatment": {
    cardIntro: "Ošetření pro pleť se sklonem k nečistotám, přetížení a nerovnováze.",
    detailIntro:
      "Clear Treatment je určený pro pleť, která potřebuje šetrně pročistit a zklidnit. Může pomoci podpořit lepší komfort pleti, ale neslibuje léčbu akné ani dermatologických potíží.",
    idealFor: [
      "problematičtější nebo přetíženou pleť",
      "sklony k ucpaným pórům",
      "pleť, která potřebuje pravidelnější čištění",
      "klientky, které chtějí praktické doporučení domácí péče",
    ],
    includes: [
      "zhodnocení stavu pleti",
      "čištění a šetrné dočištění",
      "péči zaměřenou na zklidnění",
      "sérum, masku a závěrečný krém",
      "doporučení další péče podle reakce pleti",
    ],
    results: [
      "čistší pocit pleti",
      "podporu zklidnění a většího komfortu",
      "jasnější směr domácí péče",
    ],
    goodToKnow: [
      "aktivní zánětlivé projevy je vhodné konzultovat s dermatologem",
      "po ošetření pleť zbytečně nemačkejte ani nedrážděte",
      "pravidelnost bývá důležitější než jednorázový zásah",
    ],
    seoTitle: "Clear ošetření pleti Zlín",
    seoDescription:
      "Clear Treatment v PP Studiu Zlín pro pleť se sklonem k nečistotám, šetrné čištění, zklidnění a větší komfort.",
  },
  "mens-treatment": {
    cardIntro: "Praktické ošetření mužské pleti se zaměřením na čistotu, hydrataci a komfort.",
    detailIntro:
      "Men's Treatment je kosmetické ošetření přizpůsobené potřebám mužské pleti. Zaměřuje se na čištění, zklidnění a péči, která dává smysl i bez složité rutiny.",
    idealFor: [
      "muže, kteří chtějí začít s péčí o pleť",
      "pocit unavené, suché nebo přetížené pleti",
      "pleť po období stresu, holení nebo nepravidelné péče",
      "jednoduchý restart domácí rutiny",
    ],
    includes: [
      "krátkou konzultaci a zhodnocení pleti",
      "čištění, peeling a dočištění",
      "sérum, masku a závěrečnou péči",
      "masáž krku a obličeje",
      "doporučení jednoduché domácí péče",
    ],
    results: [
      "čistší a svěžejší vzhled pleti",
      "příjemnější pocit po ošetření",
      "jednodušší orientaci v domácí péči",
    ],
    goodToKnow: [
      "před návštěvou není potřeba speciální příprava",
      "pokud je pleť podrážděná po holení, řekněte to předem",
      "průběh je vhodné ještě ověřit podle přesného protokolu pánského ošetření",
    ],
    seoTitle: "Kosmetické ošetření pro muže Zlín",
    seoDescription:
      "Pánské kosmetické ošetření v PP Studiu Zlín pro čištění, hydrataci, zklidnění a praktickou péči o mužskou pleť.",
  },
  "spicule-pdrn-treatment": {
    cardIntro: "Intenzivnější ošetření pro pleť, která potřebuje podporu obnovy a výživu.",
    detailIntro:
      "Spicule & PDRN Treatment je intenzivnější kosmetická péče pro pleť, která působí unaveně nebo potřebuje výraznější podporu komfortu. Přesný průběh je vhodné ověřit podle používaných produktů a kontraindikací.",
    idealFor: [
      "pleť bez aktivního podráždění",
      "klientky, které chtějí intenzivnější kosmetické ošetření",
      "pocit únavy, suchosti nebo ztráty jasu",
      "klientky, které už mají s kosmetikou zkušenost",
    ],
    includes: [
      "zhodnocení vhodnosti ošetření",
      "přípravu a povrchové čištění pleti",
      "aplikaci aktivní péče podle protokolu",
      "masku a závěrečnou péči",
      "doporučení následné domácí péče",
    ],
    results: [
      "opečovanější a svěžejší vzhled pleti",
      "podporu hydratovanějšího pocitu",
      "intenzivnější kosmetický zážitek než u základního ošetření",
    ],
    goodToKnow: [
      "před ošetřením je potřeba vyloučit podráždění a kontraindikace",
      "po ošetření dodržujte šetrný režim podle doporučení",
      "vyhněte se agresivní exfoliaci a aktivním látkám bez domluvy",
    ],
    seoTitle: "Spicule PDRN ošetření Zlín",
    seoDescription:
      "Spicule & PDRN ošetření v PP Studiu Zlín pro intenzivnější péči, výživu a svěžejší vzhled pleti.",
  },
  "student-treatment-15-20-let": {
    cardIntro: "Kosmetické ošetření pro mladou pleť se zaměřením na čištění a jednoduchou péči.",
    detailIntro:
      "Student Treatment je určený pro mladou pleť, která často řeší nečistoty, mastnější partie nebo nejistotu v domácí péči. Cílem je šetrné ošetření a srozumitelné doporučení, ne složitá rutina.",
    idealFor: [
      "věk přibližně 15 až 20 let",
      "ucpané póry nebo nečistoty",
      "první kosmetické ošetření",
      "klientky a klienty, kteří nevědí, jak o pleť doma pečovat",
    ],
    includes: [
      "zhodnocení mladé pleti",
      "peeling a šetrné čištění",
      "povrchové nebo mechanické dočištění podle potřeby",
      "masku a závěrečnou péči",
      "jednoduché doporučení domácí rutiny",
    ],
    results: [
      "čistší pocit pleti",
      "zklidnění po ošetření podle reakce pokožky",
      "lepší návyky v každodenní péči",
    ],
    goodToKnow: [
      "ošetření neléčí akné ani nenahrazuje dermatologa",
      "u výrazných nebo bolestivých projevů je vhodná odborná lékařská péče",
      "po návštěvě pleť nemačkejte a držte jednoduchou rutinu",
    ],
    seoTitle: "Studentské ošetření pleti Zlín",
    seoDescription:
      "Student Treatment v PP Studiu Zlín pro mladou pleť, šetrné čištění, zklidnění a jednoduché doporučení domácí péče.",
  },
  "spicule-exosomy-treatment": {
    cardIntro: "Intenzivnější kosmetická péče pro svěžejší vzhled a podporu komfortu pleti.",
    detailIntro:
      "Spicule & Exosomy Treatment je intenzivnější ošetření pro pleť, která potřebuje dodat péči, hydratovanější pocit a svěžejší vzhled. Přesné formulace je vhodné ověřit podle používaného protokolu.",
    idealFor: [
      "pleť bez aktivního podráždění",
      "situace, kdy základní ošetření nestačí",
      "pocit mdlé, unavené nebo suché pleti",
      "klientky, které chtějí cílenější kosmetickou péči",
    ],
    includes: [
      "konzultaci vhodnosti ošetření",
      "přípravu a čištění pleti",
      "aplikaci aktivní péče podle protokolu",
      "masku a závěrečné zklidnění",
      "doporučení následného režimu",
    ],
    results: [
      "svěžejší a opečovanější vzhled pleti",
      "podporu komfortu a hydratovanějšího pocitu",
      "intenzivnější péči v jedné návštěvě",
    ],
    goodToKnow: [
      "není vhodné při podrážděné nebo čerstvě narušené pleti",
      "po ošetření je důležitý šetrný režim",
      "doporučení po proceduře se může lišit podle reakce pleti",
    ],
    seoTitle: "Spicule Exosomy ošetření Zlín",
    seoDescription:
      "Spicule & Exosomy ošetření v PP Studiu Zlín pro intenzivnější kosmetickou péči a svěžejší vzhled pleti.",
  },
  "lash-lifting": {
    cardIntro: "Zvýraznění vlastních řas natočením, fixací a výživou bez prodlužování.",
    detailIntro:
      "Lash lifting zvýrazní vaše vlastní řasy bez nalepování umělých. Řasy se natočí, zafixují a vyživí, takže pohled může působit otevřeněji a upraveněji.",
    idealFor: [
      "rovnější nebo méně výrazné vlastní řasy",
      "klientky, které nechtějí prodlužování řas",
      "přirozený efekt bez každodenního kleštičkování",
      "úspora času při líčení",
    ],
    includes: [
      "zhodnocení řas a domluvu výsledného efektu",
      "natočení vlastních řas na vhodnou formu",
      "fixaci tvaru",
      "výživu a závěrečnou péči",
      "doporučení následné péče",
    ],
    results: [
      "otevřenější pohled",
      "výraznější linii vlastních řas",
      "přirozený upravený efekt bez prodlužování",
    ],
    goodToKnow: [
      "efekt obvykle vydrží 4 až 6 týdnů",
      "prvních 24 hodin řasy nenamáčejte",
      "vyhněte se páře, sauně a mastným produktům v okolí očí",
      "na návštěvu přijďte ideálně bez řasenky",
    ],
    seoTitle: "Lash lifting Zlín",
    seoDescription:
      "Lash lifting v PP Studiu Zlín zvýrazní vlastní řasy natočením, fixací a výživou pro přirozeně otevřenější pohled.",
  },
  "laminace-oboci": {
    cardIntro: "Úprava směru chloupků pro plnější, uhlazenější a přirozeně upravené obočí.",
    detailIntro:
      "Laminace obočí pomáhá usměrnit chloupky a dodat obočí upravenější tvar. Hodí se pro nepoddajné, řidší nebo nepravidelné obočí, které chcete lépe zkrotit bez trvalé změny.",
    idealFor: [
      "neposlušné nebo různými směry rostoucí chloupky",
      "řidší obočí, které potřebuje působit plněji",
      "nepravidelný tvar obočí",
      "upravenější vzhled bez každodenní fixace",
    ],
    includes: [
      "domluvu tvaru a přirozenosti výsledku",
      "úpravu směru chloupků",
      "fixaci a závěrečnou péči",
      "doporučení domácí péče",
    ],
    results: [
      "uhlazenější a plnější vzhled obočí",
      "čistší rám obličeje",
      "jednodušší každodenní úpravu",
    ],
    goodToKnow: [
      "nejde o trvalé řešení, efekt postupně odrůstá",
      "prvních 24 hodin obočí nenamáčejte",
      "vyhněte se páře a mastným produktům",
      "pravidelná výživa pomáhá udržet chloupky v lepší kondici",
    ],
    seoTitle: "Laminace obočí Zlín",
    seoDescription:
      "Laminace obočí v PP Studiu Zlín upraví směr chloupků a pomůže obočí působit plněji, uhlazeněji a přirozeně.",
  },
  "lash-lifting-plus-laminace-oboci": {
    cardIntro: "Kombinace lash liftingu a laminace obočí pro sjednocený výraz očí.",
    detailIntro:
      "Tato kombinace upraví řasy i obočí v jedné návštěvě. Hodí se, když chcete otevřenější pohled, upravenější obočí a sladěný přirozený výsledek bez prodlužování řas.",
    idealFor: [
      "klientky, které chtějí kompletnější úpravu očí",
      "úspora času jednou návštěvou",
      "vlastní řasy a obočí, které potřebují tvar",
      "upravený vzhled před dovolenou, akcí nebo pravidelně",
    ],
    includes: [
      "domluvu výsledného efektu",
      "lash lifting vlastních řas",
      "laminaci a úpravu obočí",
      "výživu a závěrečnou péči",
      "doporučení péče po proceduře",
    ],
    results: [
      "otevřenější pohled",
      "upravenější rám obličeje",
      "sladěný efekt řas a obočí",
      "méně každodenní práce s líčením",
    ],
    goodToKnow: [
      "prvních 24 hodin nenamáčejte řasy ani obočí",
      "vyhněte se páře, sauně a mastným produktům",
      "efekt obvykle postupně odrůstá v řádu týdnů",
      "přijďte ideálně bez líčení očí",
    ],
    seoTitle: "Lash lifting a laminace obočí Zlín",
    seoDescription:
      "Kombinace lash liftingu a laminace obočí v PP Studiu Zlín pro přirozeně výraznější pohled a upravený rám obličeje.",
  },
  "lymfaticka-masaz-obliceje": {
    cardIntro: "Jemná masáž obličeje pro uvolnění, relaxaci a pocit lehkosti.",
    detailIntro:
      "Lymfatická masáž obličeje je klidná péče zaměřená na uvolnění napětí a příjemný pocit lehkosti. Může podpořit svěžejší vzhled, ale nenahrazuje zdravotní terapii.",
    idealFor: [
      "chvíle, kdy se cítíte unaveně nebo napjatě",
      "klientky, které chtějí relaxační péči",
      "pocit těžšího nebo unaveného obličeje",
      "jemný reset během náročnějšího období",
    ],
    includes: [
      "krátkou domluvu očekávání",
      "klidně vedenou masáž obličeje",
      "práci s jemným tlakem a rytmem",
      "čas na doznění po masáži",
      "doporučení šetrného režimu po návštěvě",
    ],
    results: [
      "pocit uvolnění",
      "lehčí a odpočatější výraz",
      "příjemné zpomalení a regeneraci",
    ],
    goodToKnow: [
      "masáž není zdravotní léčba",
      "při akutních zdravotních potížích je vhodné službu odložit",
      "po masáži doporučuji pít vodu a nechat tělu klidnější režim",
    ],
    seoTitle: "Lymfatická masáž obličeje Zlín",
    seoDescription:
      "Lymfatická masáž obličeje v PP Studiu Zlín pro relaxaci, uvolnění napětí a příjemný pocit lehkosti.",
  },
  "barveni-oboci": {
    cardIntro: "Přirozené zvýraznění obočí odstínem sladěným s vaším typem.",
    detailIntro:
      "Barvení obočí zvýrazní přirozené chloupky a pomůže obočí působit plněji a čitelněji. Odstín volíme tak, aby ladil s vaším typem a nepůsobil tvrdě.",
    idealFor: [
      "světlé nebo méně výrazné obočí",
      "úspora času při líčení",
      "jemné zvýraznění bez výrazné změny tvaru",
      "doplňkovou službu k úpravě obočí",
    ],
    includes: [
      "výběr vhodného odstínu",
      "přípravu obočí",
      "aplikaci barvy",
      "očištění a závěrečnou kontrolu výsledku",
    ],
    results: [
      "čitelnější tvar obočí",
      "přirozeně výraznější rám obličeje",
      "jednodušší každodenní líčení",
    ],
    goodToKnow: [
      "intenzita se postupně vymývá",
      "odstín volíme podle přirozenosti a typu klientky",
      "pokud míváte reakce na barvy, upozorněte na to předem",
    ],
    seoTitle: "Barvení obočí Zlín",
    seoDescription:
      "Barvení obočí v PP Studiu Zlín pro přirozené zvýraznění chloupků, čitelnější tvar a upravený výraz obličeje.",
  },
  "barveni-ras": {
    cardIntro: "Jemné zvýraznění vlastních řas pro otevřenější pohled bez řasenky.",
    detailIntro:
      "Barvení řas zvýrazní přirozené řasy a dodá pohledu větší hloubku. Je vhodné, když chcete upravenější vzhled i ve dnech, kdy se nelíčíte.",
    idealFor: [
      "světlé nebo méně výrazné řasy",
      "úspora času s řasenkou",
      "přirozený efekt bez prodlužování",
      "pohodlnější rutinu před dovolenou nebo pravidelně",
    ],
    includes: [
      "ochranu okolí očí",
      "výběr vhodné intenzity barvení",
      "aplikaci barvy na řasy",
      "očištění a závěrečnou kontrolu",
    ],
    results: [
      "výraznější linii řas",
      "otevřenější pohled",
      "přirozený efekt bez každodenní řasenky",
    ],
    goodToKnow: [
      "přijďte ideálně bez líčení očí",
      "pokud máte citlivé oči, řekněte to předem",
      "výdrž je individuální a postupně se ztrácí s obnovou řas",
    ],
    seoTitle: "Barvení řas Zlín",
    seoDescription:
      "Barvení řas v PP Studiu Zlín pro přirozené zvýraznění vlastních řas a otevřenější pohled bez každodenní řasenky.",
  },
  "uprava-oboci": {
    cardIntro: "Tvarování obočí pro čistší linii a upravenější výraz obličeje.",
    detailIntro:
      "Úprava obočí pomáhá sjednotit tvar, odstranit přebytečné chloupky a podpořit přirozený rám obličeje. Cílem není obočí změnit k nepoznání, ale upravit ho tak, aby působilo čistě a přirozeně.",
    idealFor: [
      "obočí bez jasného tvaru",
      "jemnou úpravu výrazu obličeje",
      "pravidelnou udržovací službu",
      "přípravu před barvením nebo laminací obočí",
    ],
    includes: [
      "krátkou domluvu požadovaného tvaru",
      "odstranění přebytečných chloupků",
      "doladění linie obočí",
      "závěrečnou kontrolu symetrie",
    ],
    results: [
      "čistší linii obočí",
      "upravenější výraz obličeje",
      "přirozený výsledek bez přehnaného zásahu",
    ],
    goodToKnow: [
      "před návštěvou obočí ideálně netrhejte příliš do tenka",
      "mírné začervenání po úpravě je běžné",
      "službu lze dobře kombinovat s barvením obočí",
    ],
    seoTitle: "Úprava obočí Zlín",
    seoDescription:
      "Úprava obočí v PP Studiu Zlín pro čistší linii, přirozený tvar a upravenější výraz obličeje.",
  },
  "depilace-horniho-rtu-brady": {
    cardIntro: "Šetrná depilace drobných partií obličeje pro hladší vzhled pokožky.",
    detailIntro:
      "Depilace horního rtu a brady odstraní nežádoucí chloupky v drobných partiích obličeje. Je to rychlá služba, která pomůže pokožce působit čistěji a upraveněji.",
    idealFor: [
      "nežádoucí chloupky nad horním rtem",
      "chloupky na bradě",
      "doplňkovou službu ke kosmetickému ošetření",
      "hladší vzhled bez každodenního řešení",
    ],
    includes: [
      "krátkou kontrolu pokožky",
      "přípravu depilované oblasti",
      "odstranění chloupků",
      "závěrečné zklidnění podle potřeby",
    ],
    results: [
      "hladší pocit v ošetřené oblasti",
      "čistší vzhled pleti",
      "rychlou úpravu s minimem času",
    ],
    goodToKnow: [
      "po depilaci se může objevit dočasné zarudnutí",
      "v den depilace se vyhněte sauně, peelingu a aktivním látkám",
      "nechoďte na depilaci při podrážděné nebo poraněné pokožce",
    ],
    seoTitle: "Depilace horního rtu a brady Zlín",
    seoDescription:
      "Depilace horního rtu a brady v PP Studiu Zlín pro šetrné odstranění chloupků a hladší vzhled pokožky.",
  },
  "depilace-periferii": {
    cardIntro: "Depilace menších partií obličeje podle individuální potřeby.",
    detailIntro:
      "Depilace periferií je drobná úprava vybraných oblastí obličeje, kde chloupky ruší celkový dojem. Hodí se jako samostatná rychlá služba i jako doplněk k další péči.",
    idealFor: [
      "drobné chloupky mimo hlavní partie",
      "doladění čistého vzhledu obličeje",
      "doplňkovou službu ke kosmetice nebo úpravě obočí",
      "individuální drobnou úpravu",
    ],
    includes: [
      "domluvu konkrétních partií",
      "kontrolu pokožky",
      "šetrné odstranění chloupků",
      "závěrečnou péči podle potřeby",
    ],
    results: [
      "hladší a čistší vzhled ošetřených míst",
      "upravenější celkový dojem",
      "rychlý výsledek v krátké návštěvě",
    ],
    goodToKnow: [
      "po depilaci může být pokožka krátce citlivější",
      "v den ošetření vynechte peeling a silné aktivní látky",
      "při podráždění pokožky je lepší termín přesunout",
    ],
    seoTitle: "Depilace obličeje Zlín",
    seoDescription:
      "Depilace vybraných partií obličeje v PP Studiu Zlín pro šetrné odstranění chloupků a čistší vzhled pokožky.",
  },
  "depilace-cele-nohy": {
    cardIntro: "Depilace celých nohou pro hladší pokožku a upravený pocit.",
    detailIntro:
      "Depilace celých nohou je praktická služba pro klientky, které chtějí hladší pokožku bez každodenního holení. Hodí se pravidelně i před dovolenou nebo společenskou událostí.",
    idealFor: [
      "hladší nohy na delší dobu než po běžném holení",
      "období před dovolenou nebo sezonou šatů",
      "pravidelnou péči o pokožku nohou",
      "klientky, kterým každodenní holení nevyhovuje",
    ],
    includes: [
      "přípravu pokožky",
      "depilaci celých nohou",
      "kontrolu výsledku",
      "závěrečné zklidnění podle potřeby",
    ],
    results: [
      "hladší pocit pokožky",
      "upravenější vzhled nohou",
      "méně každodenního řešení chloupků",
    ],
    goodToKnow: [
      "chloupky by měly mít vhodnou délku pro depilaci",
      "po depilaci vynechte saunu, horkou koupel a intenzivní sport",
      "pokožku je vhodné hydratovat šetrnou péčí",
    ],
    seoTitle: "Depilace celých nohou Zlín",
    seoDescription:
      "Depilace celých nohou v PP Studiu Zlín pro hladší pokožku, upravený vzhled a pohodlnější pravidelnou péči.",
  },
  "depilace-ruce": {
    cardIntro: "Depilace rukou pro hladší pokožku a čistý, pěstěný vzhled.",
    detailIntro:
      "Depilace rukou je vhodná, pokud vám viditelné chloupky na pažích nevyhovují a chcete jemnější, hladší vzhled pokožky. Služba je praktická a dobře zapadá do pravidelné péče.",
    idealFor: [
      "výraznější chloupky na rukou",
      "hladší a upravenější vzhled pokožky",
      "období před dovolenou, focením nebo událostí",
      "pravidelnou estetickou úpravu",
    ],
    includes: [
      "přípravu pokožky",
      "depilaci rukou",
      "dočištění a kontrolu výsledku",
      "závěrečné zklidnění podle potřeby",
    ],
    results: [
      "hladší pocit pokožky",
      "čistší a pěstěnější vzhled rukou",
      "méně časté řešení chloupků než při holení",
    ],
    goodToKnow: [
      "po depilaci může být pokožka krátce citlivější",
      "v den ošetření se vyhněte sauně a intenzivnímu slunci",
      "pokožku následně hydratujte jemnou péčí",
    ],
    seoTitle: "Depilace rukou Zlín",
    seoDescription:
      "Depilace rukou v PP Studiu Zlín pro hladší pokožku, pěstěný vzhled a pohodlnou pravidelnou úpravu.",
  },
  "denni-liceni": {
    cardIntro: "Lehké denní líčení pro přirozeně upravený vzhled do práce i na schůzku.",
    detailIntro:
      "Denní líčení je vhodné, když chcete působit svěže, upraveně a přirozeně. Výsledný look přizpůsobím vašemu typu, příležitosti i tomu, v čem se cítíte dobře.",
    idealFor: [
      "práci, schůzku nebo běžný den",
      "přirozené, ne příliš výrazné líčení",
      "sjednocení pleti a jemné zvýraznění rysů",
      "focení v jemnějším stylu",
    ],
    includes: [
      "krátkou domluvu stylu",
      "přípravu pleti na líčení",
      "sjednocení pleti a jemné zvýraznění rysů",
      "doladění očí, obočí, tváří a rtů",
      "závěrečnou kontrolu výsledku",
    ],
    results: [
      "svěží a upravený vzhled",
      "přirozené zvýraznění bez těžkého dojmu",
      "větší jistotu pro konkrétní den nebo událost",
    ],
    goodToKnow: [
      "přijďte s čistou pletí nebo s běžnou péčí",
      "pokud máte oblíbený styl, klidně přineste inspiraci",
      "řekněte předem, pokud máte alergie nebo citlivou pleť",
    ],
    seoTitle: "Denní líčení Zlín",
    seoDescription:
      "Denní líčení v PP Studiu Zlín pro přirozeně upravený vzhled do práce, na schůzku nebo běžný den.",
  },
  "vecerni-spolecenske-liceni": {
    cardIntro: "Společenské líčení pro ples, večírek, focení nebo výjimečnou příležitost.",
    detailIntro:
      "Večerní a společenské líčení je výraznější než denní, ale pořád by mělo sedět vám. Styl přizpůsobím příležitosti, oblečení i tomu, jak moc výrazně se chcete cítit nalíčená.",
    idealFor: [
      "ples, večírek nebo oslavu",
      "focení nebo speciální příležitost",
      "výraznější, ale stále kultivovaný look",
      "líčení sladěné s oblečením a typem události",
    ],
    includes: [
      "domluvu stylu a intenzity líčení",
      "přípravu pleti",
      "sjednocení pleti a výraznější práci s očima nebo rty",
      "doladění detailů podle příležitosti",
      "závěrečnou kontrolu výdrže a celkového dojmu",
    ],
    results: [
      "upravený vzhled pro výjimečnou příležitost",
      "líčení sladěné s vaším stylem",
      "větší jistotu před akcí nebo focením",
    ],
    goodToKnow: [
      "inspiraci nebo fotku outfitu klidně vezměte s sebou",
      "před líčením doporučuji nepoužívat nové agresivní produkty",
      "u citlivé pleti nebo alergií dejte vědět předem",
    ],
    seoTitle: "Večerní a společenské líčení Zlín",
    seoDescription:
      "Večerní a společenské líčení v PP Studiu Zlín pro ples, focení nebo výjimečnou událost, sladěné s vaším stylem.",
  },
};
