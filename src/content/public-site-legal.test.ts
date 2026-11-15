import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCancellationPageContent, buildFaqSections, buildLegalContent } from './public-site';

test('obchodní podmínky popisují reklamaci, potvrzení a zákonnou lhůtu', () => {
  const { terms } = buildLegalContent(48);
  const complaints = terms.sections.find((section) => section.id === 'reklamace');
  assert.ok(complaints);

  const text = [...complaints.paragraphs, ...(complaints.items ?? []), complaints.note ?? ''].join(' ');
  assert.match(text, /provozovně PP Studia, e-mailem nebo telefonicky/);
  assert.match(text, /potvrzení o datu jejího přijetí/);
  assert.match(text, /obsahu a požadovaném způsobu vyřízení/);
  assert.match(text, /30 dnů/);
  assert.match(text, /dohodneme na delší lhůtě/);
  assert.match(text, /prokazatelně informována/);
  assert.match(text, /písemné odůvodnění zamítnutí/);
  assert.match(text, /zákonná práva spotřebitelky/);
});

test('obchodní podmínky uvádějí ČOI a platné informace o ADR', () => {
  const { terms } = buildLegalContent(48);
  const adr = terms.sections.find((section) => section.id === 'mimosoudni-reseni-sporu');
  assert.ok(adr);
  const text = adr.paragraphs.join(' ');
  assert.match(text, /České obchodní inspekce \(ČOI\)/);
  assert.match(text, /https:\/\/coi\.gov\.cz\/informace-o-adr\//);
  assert.match(text, /jednoho roku/);
});

test('storno texty sjednocují konfigurovanou hranici včetně přesného okamžiku', () => {
  const hours = 36;
  const legal = buildLegalContent(hours);
  const cancellation = buildCancellationPageContent({
    cancellationHours: hours,
    phone: '+420 000 000 000',
    email: 'studio@example.test',
  });
  const termsCancellation = legal.terms.sections.find((section) => section.id === 'zmena-a-zruseni-rezervace');
  const cancellationSection = cancellation.sections.find((section) => section.id === 'zruseni-a-zmena-terminu');
  const faqStorno = buildFaqSections(hours, null).find((section) => section.id === 'storno');

  assert.ok(termsCancellation);
  assert.ok(cancellationSection);
  assert.ok(faqStorno);
  for (const text of [
    termsCancellation.paragraphs.join(' '),
    cancellationSection.paragraphs.join(' '),
    faqStorno.items[0].answer,
  ]) {
    assert.match(text, /nejpozději 36 hodin/);
    assert.match(text, /storno poplatek nyní neúčtuji/i);
  }
  assert.doesNotMatch([...legal.cancellation.sections, ...legal.terms.sections, ...cancellation.sections]
    .flatMap((section) => section.paragraphs).join(' '), /bez omezení/);
});

test('odpovědnost, poukazy a smlouvy na dálku zachovávají zákonná práva', () => {
  const { terms } = buildLegalContent(48);
  const health = terms.sections.find((section) => section.id === 'zdravotni-stav-a-odpovednost');
  const vouchers = terms.sections.find((section) => section.id === 'darkove-poukazy');
  const distance = terms.sections.find((section) => section.id === 'smlouvy-na-dalku');
  const pricing = terms.sections.find((section) => section.id === 'cena-a-platba');

  assert.ok(health);
  assert.match(health.paragraphs.join(' '), /odpovědnost studia za vlastní pochybení/);
  assert.ok(vouchers);
  assert.match(vouchers.paragraphs.join(' '), /zákonná práva spotřebitelky/);
  assert.match(vouchers.paragraphs.join(' '), /práva odstoupit od smlouvy/);
  assert.ok(distance);
  assert.match(distance.paragraphs.join(' '), /14denní lhůtě/);
  assert.match(distance.paragraphs.join(' '), /samo o sobě nepovažujeme za důvod k vyloučení/);
  assert.ok(pricing);
  assert.match(pricing.paragraphs.join(' '), /změna již sjednané ceny vyžaduje její souhlas/);

  const finalTerms = terms.sections.find((section) => section.id === 'zaverecna-ustanoveni');
  assert.ok(finalTerms);
  assert.match(finalTerms.paragraphs.join(' '), /nemění již uzavřené smlouvy/);
  assert.match(finalTerms.paragraphs.join(' '), /Zákonná práva spotřebitelky tím nejsou dotčena/);
});
