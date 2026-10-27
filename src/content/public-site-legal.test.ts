import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCancellationPageContent, buildLegalContent } from './public-site';

test('obchodní podmínky obsahují informace o ČOI a reklamační lhůtě', () => {
  const { terms } = buildLegalContent(48);
  const adr = terms.sections.find((section) => section.id === 'mimosoudni-reseni-sporu');
  const complaints = terms.sections.find((section) => section.id === 'reklamace');

  assert.ok(adr);
  assert.match(adr.paragraphs.join(' '), /Česká obchodní inspekce/);
  assert.match(adr.paragraphs.join(' '), /https:\/\/adr\.coi\.cz\//);

  assert.ok(complaints);
  const complaintText = complaints.paragraphs.join(' ');
  assert.match(complaintText, /30 dnů/);
  assert.match(complaintText, /tří pracovních dnů/);
  assert.match(complaintText, /potvrzení o datu/);
  assert.match(complaintText, /písemné odůvodnění zamítnutí/);
});

test('texty storna pracují s nastaveným limitem a nezavádějí poplatek', () => {
  const hours = 36;
  const terms = buildLegalContent(hours);
  const cancellation = buildCancellationPageContent({
    cancellationHours: hours,
    phone: '+420 000 000 000',
    email: 'studio@example.test',
  });

  const termsSection = terms.terms.sections.find((section) => section.id === 'zmena-a-zruseni-rezervace');
  const cancellationSection = cancellation.sections.find((section) => section.id === 'zruseni-a-zmena-terminu');

  assert.ok(termsSection);
  assert.ok(cancellationSection);
  assert.match(termsSection.paragraphs.join(' '), /více než 36 hodin/);
  assert.match(termsSection.paragraphs.join(' '), /Storno poplatek nyní neúčtuji/);
  assert.match(cancellationSection.paragraphs.join(' '), /Storno poplatek nyní neúčtuji/);
});

test('odpovědnost a pravidla poukazů nevylučují zákonná práva', () => {
  const { terms } = buildLegalContent(48);
  const health = terms.sections.find((section) => section.id === 'zdravotni-stav-a-odpovednost');
  const vouchers = terms.sections.find((section) => section.id === 'darkove-poukazy');

  assert.ok(health);
  assert.match(health.paragraphs.join(' '), /nejsou nijak omezena její zákonná práva/);
  assert.ok(vouchers);
  assert.match(vouchers.paragraphs.join(' '), /případného práva odstoupit/);
});
