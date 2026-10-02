// Texty rozhraní. Nemění stav odpovědí, validaci ani podmínky exportu.
import { sectionTitle as originalTitle, sectionReviewed } from './caseState.js';

export function sectionTitle(step) {
  return ({ other: 'Výživné a další příjmy', minimum: 'Jak doplnit chybějící částku' })[step] || originalTitle(step);
}

export function nextStepMessage(status, data, mode, params) {
  if (status.canExport) return 'Výpočet je připravený k tisku. Zadané údaje můžete dál upravit.';
  if (status.errors.some(error => error.section === 'settings')) return 'Nejprve opravte označenou hodnotu v Odborném nastavení.';
  const step = status.flow.find(item => status.errors.some(error => error.section === item) || !sectionReviewed(data, mode, item, params));
  const invalid = status.errors.some(error => error.section === step);
  const prompts = {
    income: invalid ? 'Nejdřív doplňte příjem. Pokud žádný nemáte, zaškrtněte tuto možnost pod příjmy.' : 'Příjem je zadaný. Pokračujte k rodinné situaci tlačítkem pod příjmy.',
    incomeA: invalid ? 'Nejdřív doplňte příjem manžela A, nebo označte, že žádný nemá.' : 'Zkontrolujte příjem manžela A a pokračujte k druhému manželovi.',
    incomeB: invalid ? 'Ještě doplňte příjem manžela B, nebo označte, že žádný nemá.' : 'Zkontrolujte příjem manžela B a pokračujte k rodinné situaci.',
    family: invalid ? 'Zkontrolujte označené počty osob v části Rodinná situace.' : 'Ještě projděte rodinnou situaci a pokračujte tlačítkem pod otázkami.',
    other: invalid ? 'Ještě doplňte označenou částku výživného nebo dalších příjmů.' : 'Ještě projděte otázky na výživné a další příjmy.',
    debts: invalid ? 'Doplňte označené údaje o dluzích. Výši běžných dluhů můžete také označit jako neznámou.' : 'Ještě zkontrolujte dluhy a majetek a pokračujte tlačítkem pod otázkami.',
    execution: invalid ? 'Zkontrolujte označené údaje o exekuci.' : 'Ještě zkontrolujte údaje o exekuci a pokračujte tlačítkem pod otázkami.',
    minimum: invalid ? 'Doplňte částky u zvolené pomoci se splácením, nebo nepoužitou možnost vypněte.' : 'Ještě zkontrolujte, jak doplníte chybějící částku pro oddlužení.',
  };
  return prompts[step] || 'Ještě projděte zadané údaje.';
}

export const SHORT_MODEL_NOTE = 'Odhad splacení níže nezahrnuje vaše další platby z vlastních peněz ani pomoc jiné osoby. Ty se používají jen k ověření měsíčního minima.';
