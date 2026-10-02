import React from 'react';
import catalogue from './approvedHelp.json';

// Approved text is data, not a fresh paraphrase. Legal details live outside
// checkbox labels so opening them cannot change the user's answer.
export default function ApprovedHelp({ name, id }) {
  const entry = catalogue.entries[name];
  if (!entry) throw new Error(`Unknown approved help: ${name}`);
  return <div id={id} data-approved-help={name} className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
    <p data-help-layer="plain"><strong>Lidsky řečeno:</strong> {entry.plain}</p>
    {entry.legal && <details>
      <summary className="cursor-pointer font-bold">Právně přesně</summary>
      <p data-help-layer="legal" className="mt-2">{entry.legal}</p>
    </details>}
  </div>;
}

export function optionalHelpKey(field, mode) {
  return {
    spolecneDeti: 'commonChildren',
    vyzivovaneOsoby1: mode === 'manzele' ? 'dependentsA' : 'dependentsSingle',
    vyzivovaneOsoby2: 'dependentsB',
    osobySVykonemProVyzivne1: 'enforcedAlimonyA',
    osobySVykonemProVyzivne2: 'enforcedAlimonyB',
    bezneMesicniVyzivne1: 'alimonyA',
    bezneMesicniVyzivne2: 'alimonyB',
    chranenePrijmy1: 'protectedIncomeA',
    chranenePrijmy2: 'protectedIncomeB',
    vytezekZpenezeni: 'assetProceeds',
    dluhyZajistene: 'securedDebt',
    dluhyNeosvoboditelne: 'nonDischargeable',
  }[field];
}
