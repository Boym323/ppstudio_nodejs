# 0115 Mobilní ergonomie administrace v1

## Kontext

Administrace už měla responzivní mobilní varianty, ale ovladače v pracovním seznamu rezervací a planneru byly při každodenní práci na telefonu příliš drobné nebo husté.

## Rozhodnutí

- Mobilní filtry rezervací zůstávají v jednom vodorovně posuvném řádku.
- Rychlé akce rezervace a akce filtrů mají na mobilu větší dotykovou plochu a jasné dvousloupcové uspořádání.
- Planner zvětšuje mobilní buňky, navigaci týdnů i přepínač dnů; selected den používá `aria-current`.
- Spodní sheet inspektoru a sticky publish lišta respektují spodní safe area telefonu.

## Alternativy

- Oddělená mobilní administrace nebo samostatná route planneru.
- Redukce filtrů a rychlých akcí pouze pro mobil.

## Důsledky

- Běžné potvrzení rezervace, filtrování a úprava dostupnosti jsou lépe ovladatelné jednou rukou.
- Datový model, routy, role i server actions se nemění.

## Stav

schváleno
