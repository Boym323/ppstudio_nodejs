# 0054 Booking Contiguous Slot Chaining v1

## Stav

Accepted

## Kontext

Veřejný booking i self-service přesun dříve uměly pracovat jen s jedním fyzickým `AvailabilitySlot`. Pokud byl volný čas v kalendáři rozdělený do několika navazujících publikovaných segmentů, delší služba se klientce vůbec nenabídla, i když souvislý čas fakticky existoval.

## Rozhodnutí

- Veřejný katalog slotů skládá navazující kompatibilní publikované segmenty do jednoho delšího okna.
- Kompatibilita pro sloučení znamená:
  - bezprostřední návaznost bez mezery,
  - stejná kapacita,
  - stejný `serviceRestrictionMode`,
  - stejná množina povolených služeb,
  - stejný `publicNote`.
- Sloučený katalogový slot si nese i seznam původních segmentů, aby UI při výběru konkrétního času poslalo správný podkladový `slotId`.
- Backend vytvoření rezervace i přesunu termínu validuje, že zvolený interval pokrývá souvislý řetězec publikovaných segmentů bez mezer a bez blokujících nepublikovaných intervalů.
- Kapacita se při takové validaci bere jako minimum napříč všemi pokrytými segmenty a konflikt kontrola pracuje nad sloty z celého řetězce.

## Dopady

- Delší služby se mohou veřejně nabízet i tehdy, když jsou ručně publikované jako více sousedních slotů.
- UI a backend sdílejí jednu coverage logiku, takže nevzniká stav, kdy frontend nabídne čas, který backend neumí potvrdit.
- Zůstává zachovaný stávající datový model `Booking.slotId`; booking je ukotvený na segment, ve kterém vybraný čas skutečně začíná.
