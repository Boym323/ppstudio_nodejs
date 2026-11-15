'use client';

import { useState, type ReactNode } from 'react';
import * as AlertDialog from '@/components/ui/alert-dialog';
import { bulkMediaAction } from '@/features/admin/actions/media-actions';
import { PendingSubmitButton } from './pending-submit-button';
import type { AdminArea } from '@/config/navigation';

type Item = { id: string; title: string; isUsed: boolean; content: ReactNode };

export function MediaLibraryResults({ area, items, layout, returnTo }: { area: AdminArea; items: Item[]; layout: 'list' | 'grid'; returnTo: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [operation, setOperation] = useState<'publish' | 'unpublish' | 'delete'>('publish');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const chosen = items.filter((item) => selected.includes(item.id));
  const usedCount = chosen.filter((item) => item.isUsed).length;
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm">
      <label className="flex min-h-11 items-center gap-2 text-white/75"><input type="checkbox" checked={chosen.length === items.length && items.length > 0} onChange={(event) => setSelected(event.target.checked ? items.map(({ id }) => id) : [])}/> Vybrat tuto stránku</label>
      <span aria-live="polite" className="text-white/50">Vybráno {chosen.length}</span>
      {chosen.length ? <><label className="sr-only" htmlFor="media-bulk-operation">Hromadná akce</label><select id="media-bulk-operation" value={operation} onChange={(event) => setOperation(event.target.value as typeof operation)} className="min-h-11 rounded-lg border border-white/15 bg-[#211e24] px-3 text-white"><option value="publish">Publikovat</option><option value="unpublish">Zrušit publikaci</option><option value="delete">Smazat nepoužitá</option></select><button type="button" onClick={() => setConfirmOpen(true)} className="min-h-11 rounded-full border border-white/15 px-4 text-white">Pokračovat</button><button type="button" onClick={() => setSelected([])} className="min-h-11 text-white/60">Zrušit výběr</button></> : null}
    </div>
    <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-2'}>
      {items.map((item) => <div key={item.id} className={`flex items-start gap-2 ${selected.includes(item.id) ? 'rounded-xl ring-1 ring-[var(--color-accent)]/50' : ''}`}><label className="flex min-h-11 min-w-8 shrink-0 items-center justify-center"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} aria-label={`Vybrat ${item.title}`}/></label><div className="min-w-0 flex-1">{item.content}</div></div>)}
    </div>
    <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}><AlertDialog.Portal><AlertDialog.Overlay/><AlertDialog.Content className="rounded-2xl border border-white/10 bg-[#131116] p-5">
      <AlertDialog.Title>{operation === 'delete' ? 'Trvale smazat nepoužité soubory?' : operation === 'unpublish' ? 'Zrušit publikaci vybraných souborů?' : 'Publikovat vybrané soubory?'}</AlertDialog.Title>
      <AlertDialog.Description>Vybráno {chosen.length} souborů. {operation === 'delete' ? `Používané soubory (${usedCount}) budou přeskočeny. Smazání ostatních nelze vrátit.` : operation === 'unpublish' ? `Přiřazené soubory (${usedCount}) mohou zmizet z webu. Jejich přiřazení zůstane zachované.` : 'Soubory budou veřejně dostupné. Přiřazené fotografie se mohou zobrazit na webu.'}</AlertDialog.Description>
      <ul className="mt-3 max-h-40 overflow-y-auto text-sm text-white/65">{chosen.map((item) => <li key={item.id}>{item.title}</li>)}</ul>
      <form action={bulkMediaAction} className="mt-5 flex flex-wrap justify-end gap-3"><input type="hidden" name="area" value={area}/><input type="hidden" name="operation" value={operation}/><input type="hidden" name="confirmed" value="true"/><input type="hidden" name="returnTo" value={returnTo}/>{chosen.map(({ id }) => <input key={id} type="hidden" name="assetId" value={id}/>)}<AlertDialog.Cancel asChild><button type="button" className="min-h-11 px-4 text-white/70">Zrušit</button></AlertDialog.Cancel><PendingSubmitButton disabled={!chosen.length} pendingLabel="Zpracovávám…" className="min-h-11 rounded-full border border-white/20 px-4 text-white">{operation === 'delete' ? 'Trvale smazat nepoužitá' : 'Potvrdit'}</PendingSubmitButton></form>
    </AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>
  </div>;
}
