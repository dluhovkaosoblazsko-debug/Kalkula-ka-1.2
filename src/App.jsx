import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Users, User, Info, AlertCircle,
  ShieldAlert, Settings, Layers, Printer, Gavel
} from 'lucide-react';

// --- POMOCNÁ KOMPONENTA PRO TOOLTIPY ---
const Tooltip = ({ children, text }) => (
  <div className="group relative flex items-center gap-1.5 w-fit cursor-help">
    {children}
    <Info size={13} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0 print:hidden" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-slate-800 text-white text-[11px] font-medium rounded-lg shadow-xl z-50 text-center pointer-events-none print:hidden leading-snug">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);


const colorMap = {
  blue: {
    border: 'border-blue-200',
    title: 'text-blue-600',
    value: 'text-blue-900',
    unit: 'text-blue-700',
    subtitle: 'text-blue-600',
    dotted: 'border-blue-400',
  },
  green: {
    border: 'border-green-200',
    title: 'text-green-600',
    value: 'text-green-900',
    unit: 'text-green-700',
    subtitle: 'text-green-600',
    dotted: 'border-green-400',
  },
  red: {
    border: 'border-red-200',
    title: 'text-red-600',
    value: 'text-red-900',
    unit: 'text-red-700',
    subtitle: 'text-red-600',
    dotted: 'border-red-400',
  },
  slate: {
    border: 'border-slate-200',
    title: 'text-slate-600',
    value: 'text-slate-900',
    unit: 'text-slate-700',
    subtitle: 'text-slate-600',
    dotted: 'border-slate-400',
  },
  indigo: {
    border: 'border-indigo-200',
    title: 'text-indigo-600',
    value: 'text-indigo-900',
    unit: 'text-indigo-700',
    subtitle: 'text-indigo-600',
    dotted: 'border-indigo-400',
  },
}

const App = () => {
  const [activeTab, setActiveTab] = useState('jednotlivec');
  const [isLoaded, setIsLoaded] = useState(false);

  // --- LEGISLATIVNÍ DATA (Stav pro výplaty v roce 2026) ---
  const [params, setParams] = useState(() => {
    const defaultParams = {
      zivotniMinimum: 4860,
      normativniNajemne: 9430, // Pro srážky se používá vždy tento standardní normativ
      energetickyPausal: 2300,
      odmenaSpravceJednotlivec: 1089,
      odmenaSpravceManzele: 1633.5,
      pausalniNahradaPlatce: 50,
      koeficientZahladu: 85, // v procentech
      koeficientZabavitelnosti: 1.9,
      limit4PlusPension: 1089, // Fixní práh pro výjimku
      minSplatkaJednotlivec: 2178, // Doplněno
      minSplatkaManzele: 3267 // Doplněno
    };
    try {
      const saved = localStorage.getItem('insCalcParams2026_v10');
      return saved ? { ...defaultParams, ...JSON.parse(saved) } : defaultParams;
    } catch { 
      return defaultParams; 
    }
  });

  // --- VSTUPNÍ DATA ---
  const [data, setData] = useState(() => {
    const defaultData = {
      // Příjmy 1
      prijemMzda1: 200000,
      prijemDuchod1: 0,
      prijemDalsi1: 0,
      chranenePrijmy1: 0, 
      
      // Příjmy 2
      prijemMzda2: 25000,
      prijemDuchod2: 0,
      prijemDalsi2: 0,
      
      // Domácnost
      spolecneDeti: 2,
      
      // Parametry dlužníka 1
      vyzivovaneOsoby1: 0, 
      osobySVykonemProVyzivne1: 0, 
      maManzelaPartnera1: false,
      duchodPovinny1: false,
      duchodPartner1: false,
      bezneMesicniVyzivne1: 0,
      
      // Parametry dlužníka 2
      vyzivovaneOsoby2: 0,
      osobySVykonemProVyzivne2: 0,
      duchodPovinny2: false,
      bezneMesicniVyzivne2: 0,

      // Exekuční parametry
      typPohledavky: 'neprednostni', 
      pocetExekuci: '1-3',
      uplatnitPausalPlatce: false,
      
      // Insolvenční parametry a dluhy
      delkaOddluzeni: 36,
      dluhyNezajistene: 600000,
      dluhyZajistene: 0,
      dluhyNeosvoboditelne: 0, 
      vytezekZpenezeni: 0, 
    };
    try {
      const saved = localStorage.getItem('insCalcData2026_v10');
      return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
    } catch { 
      return defaultData; 
    }
  });

  useEffect(() => {
    localStorage.setItem('insCalcParams2026_v10', JSON.stringify(params));
    localStorage.setItem('insCalcData2026_v10', JSON.stringify(data));
    setIsLoaded(true);
  }, [params, data]);

  // --- JÁDRO VÝPOČTU ---
  const calculateResult = ({
    prijem, 
    chranenyPrijem = 0, 
    pocetVyz, 
    maPartnera, 
    duchodPovinny, 
    duchodPartner, 
    vykonProVyzivne, 
    typ, 
    pocetExekuci, 
    uplatnitPausal, 
    mode = 'exekuce'
  }) => {
    
    const soucetZakladu = params.zivotniMinimum + params.normativniNajemne + params.energetickyPausal;
    
    const zakladNaPovinneho = soucetZakladu * (params.koeficientZahladu / 100); 
    const jednaCtvrtina = zakladNaPovinneho / 4;    

    const zapocitatPartnera = maPartnera && (duchodPovinny || duchodPartner);

    const pocetVsechOsob = pocetVyz + (zapocitatPartnera ? 1 : 0);
    let pocetCtvrtin = pocetVsechOsob;
    pocetCtvrtin = Math.max(0, pocetCtvrtin - vykonProVyzivne);

    const celkovaNezabavitelnaRaw = zakladNaPovinneho + (pocetCtvrtin * jednaCtvrtina);
    const legalniNezabavitelnaCastka = Math.ceil(celkovaNezabavitelnaRaw);

    const zbytekMzdy = prijem - legalniNezabavitelnaCastka;
    if (zbytekMzdy <= 0) {
      return { 
        srazka: 0, srazkaCista: 0, nahradaPlatci: 0, kVyplate: prijem + chranenyPrijem, kVyplateZeSrazek: prijem,
        legalniMinimum: legalniNezabavitelnaCastka, tretina: 0, plneZabavitelna: 0, zbytekKDeleni: 0, zaokrouhlovaciZbytek: 0,
        forceTwoThirds: false, exception4PlusApplied: false, maxPrednostniFond: 0, hranicePlneZabavitelna: 0,
        zbytekMzdyRaw: zbytekMzdy, prijemPredSrazkou: prijem, partnerZapocitan: zapocitatPartnera,
        zakladNaPovinneho, jednaCtvrtina, pocetVsechOsob, vykonProVyzivne, pocetCtvrtin, celkovaNezabavitelnaRaw
      };
    }

    const hranicePlneZabavitelna = Math.floor(soucetZakladu * params.koeficientZabavitelnosti);

    const plneZabavitelnaCast = Math.max(0, zbytekMzdy - hranicePlneZabavitelna);
    const castDoLimitu = Math.min(zbytekMzdy, hranicePlneZabavitelna);

    const castDoTretin = Math.floor(castDoLimitu / 3) * 3;
    const tretina = castDoTretin / 3;
    const zaokrouhlovaciZbytek = castDoLimitu - castDoTretin;

    const has4Plus = pocetExekuci === '4+';
    const exception4Plus = duchodPovinny && (tretina < params.limit4PlusPension);
    const apply4PlusRule = has4Plus && !exception4Plus;

    const isPriority = typ === 'prednostni' || typ === 'vyzivne' || mode === 'insolvence';
    const forceTwoThirds = isPriority || apply4PlusRule;
    
    let srazka = forceTwoThirds ? ((2 * tretina) + plneZabavitelnaCast) : (tretina + plneZabavitelnaCast);

    let nahradaPlatci = 0;
    if (mode === 'exekuce' && uplatnitPausal && srazka > 0) {
        nahradaPlatci = Math.min(params.pausalniNahradaPlatce, Math.ceil(srazka / 3));
    }

    let maxPrednostniFond = 0;
    if (typ === 'vyzivne') {
        maxPrednostniFond = tretina + plneZabavitelnaCast; 
    }

    return {
      srazka,
      srazkaCista: srazka - nahradaPlatci,
      nahradaPlatci,
      kVyplateZeSrazek: prijem - srazka,
      kVyplate: (prijem - srazka) + chranenyPrijem, 
      chranenyPrijem,
      legalniMinimum: legalniNezabavitelnaCastka,
      tretina,
      plneZabavitelna: plneZabavitelnaCast,
      zbytekKDeleni: castDoLimitu,
      zaokrouhlovaciZbytek,
      forceTwoThirds,
      exception4PlusApplied: has4Plus && exception4Plus,
      maxPrednostniFond,
      partnerZapocitan: zapocitatPartnera,
      hranicePlneZabavitelna,
      zbytekMzdyRaw: zbytekMzdy,
      prijemPredSrazkou: prijem,
      zakladNaPovinneho,
      jednaCtvrtina,
      pocetVsechOsob,
      vykonProVyzivne,
      pocetCtvrtin,
      celkovaNezabavitelnaRaw
    };
  };

  const results = useMemo(() => {
    const totalPrijem1 = data.prijemMzda1 + data.prijemDuchod1 + data.prijemDalsi1;
    const totalPrijem2 = data.prijemMzda2 + data.prijemDuchod2 + data.prijemDalsi2;

    const pocetVyzD1 = activeTab === 'manzele' ? (data.spolecneDeti + data.vyzivovaneOsoby1) : data.vyzivovaneOsoby1;

    // --- List 1: Exekuce (Jednotlivec 1) ---
    const ex = calculateResult({
      prijem: totalPrijem1,
      chranenyPrijem: data.chranenePrijmy1,
      pocetVyz: pocetVyzD1,
      maPartnera: data.maManzelaPartnera1,
      duchodPovinny: data.duchodPovinny1,
      duchodPartner: data.duchodPartner1,
      vykonProVyzivne: data.osobySVykonemProVyzivne1,
      typ: data.typPohledavky,
      pocetExekuci: data.pocetExekuci,
      uplatnitPausal: data.uplatnitPausalPlatce,
      mode: 'exekuce'
    });
    
    // --- List 2: Insolvence Jednotlivec 1 ---
    const insJ = calculateResult({
      prijem: totalPrijem1,
      chranenyPrijem: data.chranenePrijmy1,
      pocetVyz: pocetVyzD1,
      maPartnera: data.maManzelaPartnera1,
      duchodPovinny: data.duchodPovinny1,
      duchodPartner: data.duchodPartner1,
      vykonProVyzivne: data.osobySVykonemProVyzivne1,
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence'
    });
    
    const proVeriteleJ = Math.max(0, insJ.srazka - params.odmenaSpravceJednotlivec - data.bezneMesicniVyzivne1);
    const celkemProVeriteleJ = (proVeriteleJ * data.delkaOddluzeni) + data.vytezekZpenezeni;
    const uspokojeniJ = data.dluhyNezajistene > 0 ? (celkemProVeriteleJ / data.dluhyNezajistene) * 100 : 0;
    
    const rizikoNepovoleniJ = insJ.srazka < params.minSplatkaJednotlivec || proVeriteleJ <= 0;

    // --- List 3: Insolvence Manželé ---
    const insM_A = calculateResult({
      prijem: totalPrijem1,
      chranenyPrijem: data.chranenePrijmy1,
      pocetVyz: pocetVyzD1,
      maPartnera: false,
      duchodPovinny: data.duchodPovinny1,
      duchodPartner: false,
      vykonProVyzivne: data.osobySVykonemProVyzivne1,
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence'
    });
    
    const insM_B = calculateResult({
      prijem: totalPrijem2,
      chranenyPrijem: 0, 
      pocetVyz: data.spolecneDeti + data.vyzivovaneOsoby2,
      maPartnera: false,
      duchodPovinny: data.duchodPovinny2,
      duchodPartner: false,
      vykonProVyzivne: data.osobySVykonemProVyzivne2,
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence'
    });
    
    const srazkaCelkemM = insM_A.srazka + insM_B.srazka;
    const kVyplateCelkemM = insM_A.kVyplate + insM_B.kVyplate;
    const proVeriteleM = Math.max(0, srazkaCelkemM - params.odmenaSpravceManzele - data.bezneMesicniVyzivne1 - data.bezneMesicniVyzivne2);
    const celkemProVeriteleM = (proVeriteleM * data.delkaOddluzeni) + data.vytezekZpenezeni;
    const uspokojeniM = data.dluhyNezajistene > 0 ? (celkemProVeriteleM / data.dluhyNezajistene) * 100 : 0;
    const rizikoNepovoleniM = srazkaCelkemM < params.minSplatkaManzele || proVeriteleM <= 0;

    return { 
      ex, insJ, proVeriteleJ, uspokojeniJ, rizikoNepovoleniJ, totalPrijem1, celkemProVeriteleJ,
      insM_A, insM_B, srazkaCelkemM, kVyplateCelkemM, proVeriteleM, uspokojeniM, rizikoNepovoleniM, totalPrijem2, celkemProVeriteleM 
    };
  }, [data, params, activeTab]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const handlePrint = () => window.print();

  if (!isLoaded) return null;

  const renderMathStep1 = (res, params) => {
    const textZaklad = res.zakladNaPovinneho.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const textCtvrtina = res.jednaCtvrtina.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const textSuma = res.celkovaNezabavitelnaRaw.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let note = res.pocetCtvrtin > 0 ? `(Osoby k zápočtu)` : `(Bez osob)`;
    if (res.vykonProVyzivne > 0) {
        note = `(Z ${res.pocetVsechOsob} osob odečteno ${res.vykonProVyzivne} pro výživné)`;
    }
    return (
        <p>1. <strong className="text-slate-700">Nezab. částka:</strong> {textZaklad} (Základ {params.koeficientZahladu} %) + {res.pocetCtvrtin} × {textCtvrtina} {note} = {textSuma} → zaokrouhleno <strong className="text-slate-700">{res.legalniMinimum.toLocaleString()} Kč</strong></p>
    );
  };

  const AnalyticCard = ({ title, titleTooltip, value, unit="Kč", subtitle, color="blue", children }) => {
    const c = colorMap[color] ?? colorMap.blue

    return (
      <div className={`p-5 rounded-xl border bg-white ${c.border} shadow-sm flex flex-col h-full print:border-gray-300 print:shadow-none`}>
        <div className="flex items-center gap-1.5 mb-2">
          {titleTooltip ? (
            <Tooltip text={titleTooltip}>
              <span className={`text-[11px] font-bold ${c.title} uppercase tracking-widest cursor-help border-b border-dotted ${c.dotted} print:border-none print:text-gray-800`}>{title}</span>
            </Tooltip>
          ) : (
            <p className={`text-[11px] font-bold ${c.title} uppercase tracking-widest print:text-gray-800`}>{title}</p>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          {value !== undefined && <span className={`text-3xl font-black ${c.value} print:text-black`}>{Math.round(value).toLocaleString()}</span>}
          {unit && value !== undefined && <span className={`text-sm font-bold ${c.unit} print:text-gray-600`}>{unit}</span>}
        </div>
        {subtitle && <p className={`text-[11px] ${c.subtitle} mt-2 font-medium leading-relaxed print:text-gray-600`}>{subtitle}</p>}
        {children && <div className="mt-4 pt-4 border-t border-slate-100 flex-1">{children}</div>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800 print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4 print:pb-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2 print:hidden">
              <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded">PRÁVNÍ STAV 2026</span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">VÝUKOVÝ MODEL</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 print:text-xl">
              <Calculator className="text-blue-600 print:text-black" /> Kalkulačka srážek a oddlužení
            </h1>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
              <Printer size={14} /> Tisk / PDF
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap p-1 bg-slate-200 rounded-xl mb-6 print:hidden">
          {[
            { id: 'jednotlivec', label: 'Oddlužení (Jednotlivec)', icon: User },
            { id: 'manzele', label: 'Oddlužení (Manželé)', icon: Users },
            { id: 'nezabavitelna', label: 'Exekuce (Srážky)', icon: ShieldAlert },
            { id: 'nastaveni', label: 'Legislativa', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon size={16} /><span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="grid lg:grid-cols-12 gap-6 print:block">
          {/* LEVÝ PANEL - Vstupy */}
          {activeTab !== 'nastaveni' && (
            <aside className="lg:col-span-5 space-y-4 print:hidden">
              
              {/* SEKCE 1: RODINA (SPOLEČNÉ ÚDAJE) - VIDITELNÁ JEN U MANŽELŮ */}
              {activeTab === 'manzele' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-indigo-400">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Users size={14}/> Společná situace rodiny
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Tooltip text="Společné děti, ke kterým máte vyživovací povinnost vy i manžel/ka. V oddlužení manželů se systémově započítají do nezabavitelné částky oběma dlužníkům naráz.">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Společné děti</label>
                      </Tooltip>
                      <input type="number" name="spolecneDeti" value={data.spolecneDeti} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold" />
                    </div>
                  </div>
                </div>
              )}

              {/* SEKCE 2: DLUŽNÍK 1 */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-blue-400">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <User size={14}/> {activeTab === 'manzele' ? 'Příjmy a status: Manžel A' : 'Příjmy a status dlužníka'}
                </h3>
                
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Tooltip text="Zadejte průměrnou čistou měsíční mzdu po odečtení daní a odvodů. Nezahrnujte sem nezabavitelné dávky ani cestovní náhrady.">
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Čistá Mzda</label>
                    </Tooltip>
                    <input type="number" name="prijemMzda1" value={data.prijemMzda1} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                  </div>
                  <div>
                    <Tooltip text="Sem zadejte postižitelné důchody vyplácené dlužníkovi. Nezaměňujte to s právním statusem pro zvláštní ochranu u 4+ exekucí a pro započtení partnera; ten se týká jen starobního důchodu, invalidního důchodu II./III. stupně a sirotčího důchodu (vdovský či vdovecký důchod v tomto speciálním pravidle výslovně uveden není).">
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Důchody</label>
                    </Tooltip>
                    <input type="number" name="prijemDuchod1" value={data.prijemDuchod1} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                  </div>
                  <div>
                    <Tooltip text="Sem patří jen jiné postižitelné příjmy, se kterými se pro účely srážek zachází obdobně jako se mzdou. U odstupného a dlužné mzdy platí zvláštní pravidla (počítají se samostatně za příslušný počet měsíců); tato kalkulačka je v tomto poli bere jen orientačně.">
                      <label className="block text-[9px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">DPP / Jiné</label>
                    </Tooltip>
                    <input type="number" name="prijemDalsi1" value={data.prijemDalsi1} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-800 leading-snug">
                  <strong>Souběh více plátců:</strong> Jednoduché sčítání příjmů (např. mzda + důchod) je pouze orientační. V praxi exekutor určuje, jakou část nezabavitelné částky nemá srážet každý jednotlivý plátce.
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Tooltip text={activeTab === 'manzele' ? "Děti (např. z předchozího vztahu), ke kterým má vyživovací povinnost pouze tento konkrétní dlužník." : "Zadejte počet dětí a dalších osob, ke kterým máte zákonnou vyživovací povinnost. Manžela/partnera sem nepočítejte, ten se zaškrtává zvlášť."}>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">
                        {activeTab === 'manzele' ? 'Děti (pouze vlastní)' : 'Vyživované děti'}
                      </label>
                    </Tooltip>
                    <input type="number" name="vyzivovaneOsoby1" value={data.vyzivovaneOsoby1} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                  </div>
                  <div>
                    <Tooltip text="Pokud na některou z osob (např. dítě) aktuálně probíhá exekuce pro výživné, tato osoba se vám do nezabavitelného minima nezapočítává. Zadejte jejich počet.">
                       <label className="block text-[10px] font-bold text-amber-700 mb-1 w-fit cursor-help border-b border-dotted border-amber-600">Z toho s výkonem výž.</label>
                    </Tooltip>
                    <input type="number" name="osobySVykonemProVyzivne1" value={data.osobySVykonemProVyzivne1} onChange={handleInputChange} max={(activeTab === 'manzele' ? data.spolecneDeti : 0) + data.vyzivovaneOsoby1 + (data.maManzelaPartnera1 ? 1 : 0)} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-900 text-sm" />
                  </div>
                </div>

                {activeTab !== 'manzele' && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer w-fit">
                      <input type="checkbox" name="maManzelaPartnera1" checked={data.maManzelaPartnera1} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                      <Tooltip text="Zaškrtněte, pokud máte manžela, manželku nebo registrovaného partnera. Samo o sobě to ale vaši nezabavitelnou částku nezvýší.">
                        <span className="text-xs font-bold text-slate-700 cursor-help border-b border-dotted border-slate-400">Mám partnera (manžela)</span>
                      </Tooltip>
                    </label>
                    
                    {data.maManzelaPartnera1 && (
                      <label className="flex items-start gap-2 cursor-pointer pl-6 w-fit">
                        <input type="checkbox" name="duchodPartner1" checked={data.duchodPartner1} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                        <Tooltip text="Od 1. 1. 2026 se partner započítává jako vyživovaná osoba (přidá vám 'čtvrtinu' peněz k dobru) POUZE tehdy, pokud vy nebo on pobíráte starobní, invalidní (II./III. st.) nebo sirotčí důchod.">
                          <span className="text-[10px] font-medium text-slate-600 leading-tight cursor-help border-b border-dotted border-slate-400">Tento partner pobírá starobní / invalidní důchod (II./III. st.) / sirotčí důchod.</span>
                        </Tooltip>
                      </label>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer w-fit">
                  <input type="checkbox" name="duchodPovinny1" checked={data.duchodPovinny1} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                  <Tooltip text="Váš důchod má dva efekty: 1) Zajistí vám čtvrtinu navíc na partnera. 2) Může vás ochránit před nejpřísnější srážkou, pokud máte 4 a více exekucí a nízký příjem.">
                    <span className="text-[10px] font-medium text-slate-700 leading-tight cursor-help border-b border-dotted border-slate-400">Já / Dlužník pobírá starobní / invalidní (II./III. st.) / sirotčí důchod.</span>
                  </Tooltip>
                </label>

                {activeTab !== 'nezabavitelna' && (
                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text="Zadejte částku běžného měsíčního výživného, kterou máte platit. V insolvenci se tyto peníze srážejí z vašeho příjmu přednostně před ostatními věřiteli.">
                      <label className="block text-[10px] font-bold text-red-600 mb-1 w-fit cursor-help border-b border-dotted border-red-400">Běžné měsíční výživné k úhradě</label>
                    </Tooltip>
                    <input type="number" name="bezneMesicniVyzivne1" value={data.bezneMesicniVyzivne1} onChange={handleInputChange} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg outline-none font-bold text-red-800 text-sm" />
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100">
                  <Tooltip text="Sem patří pouze peníze, které exekuci nepodléhají vůbec – např. dávky v hmotné nouzi, jednorázové sociální dávky nebo daňový bonus na dítě. Nepište sem důchod!">
                    <label className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Chráněné příjmy (nepodléhající exekuci)</label>
                  </Tooltip>
                  <input type="number" name="chranenePrijmy1" value={data.chranenePrijmy1} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg outline-none font-bold text-green-900 text-sm" />
                </div>
              </div>

              {/* SEKCE 3: DLUŽNÍK 2 (JEN PRO MANŽELE) */}
              {activeTab === 'manzele' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-purple-400">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <User size={14}/> Příjmy a status: Manžel B
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Tooltip text="Čistá mzda druhého manžela.">
                        <label className="block text-[9px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Čistá Mzda</label>
                      </Tooltip>
                      <input type="number" name="prijemMzda2" value={data.prijemMzda2} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                    </div>
                    <div>
                      <Tooltip text="Sem zadejte postižitelné důchody vyplácené dlužníkovi. Nezaměňujte to s právním statusem pro zvláštní ochranu u 4+ exekucí a pro započtení partnera; ten se týká jen starobního důchodu, invalidního důchodu II./III. stupně a sirotčího důchodu.">
                        <label className="block text-[9px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Důchody</label>
                      </Tooltip>
                      <input type="number" name="prijemDuchod2" value={data.prijemDuchod2} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                    </div>
                    <div>
                      <Tooltip text="Sem patří jen jiné postižitelné příjmy, se kterými se pro účely srážek zachází obdobně jako se mzdou. U odstupného a dlužné mzdy platí zvláštní pravidla; tato kalkulačka je v tomto poli bere jen orientačně.">
                        <label className="block text-[9px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">DPP / Jiné</label>
                      </Tooltip>
                      <input type="number" name="prijemDalsi2" value={data.prijemDalsi2} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <Tooltip text="Děti (např. z předchozího vztahu), ke kterým má vyživovací povinnost jen tento druhý manžel.">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Děti (pouze vlastní)</label>
                      </Tooltip>
                      <input type="number" name="vyzivovaneOsoby2" value={data.vyzivovaneOsoby2} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                    </div>
                    <div>
                      <Tooltip text="Počet dětí druhého manžela, u kterých právě probíhá výkon rozhodnutí pro výživné.">
                        <label className="block text-[10px] font-bold text-amber-700 mb-1 w-fit cursor-help border-b border-dotted border-amber-600">Z toho s výkonem výž.</label>
                      </Tooltip>
                      <input type="number" name="osobySVykonemProVyzivne2" value={data.osobySVykonemProVyzivne2} onChange={handleInputChange} max={data.spolecneDeti + data.vyzivovaneOsoby2} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-900 text-sm" />
                    </div>
                  </div>

                  <label className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer w-fit">
                    <input type="checkbox" name="duchodPovinny2" checked={data.duchodPovinny2} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                    <Tooltip text="Důchod druhého manžela může chránit jeho příjem před tvrdší srážkou v případě 4 a více exekucí na jeho jméno.">
                      <span className="text-[10px] font-medium text-slate-700 leading-tight cursor-help border-b border-dotted border-slate-400">Dlužník (M2) pobírá starobní / invalidní (II./III. st.) / sirotčí důchod.</span>
                    </Tooltip>
                  </label>

                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text="Přednostně srážené výživné z platu druhého manžela.">
                      <label className="block text-[10px] font-bold text-red-600 mb-1 w-fit cursor-help border-b border-dotted border-red-400">Běžné měsíční výživné k úhradě (M2)</label>
                    </Tooltip>
                    <input type="number" name="bezneMesicniVyzivne2" value={data.bezneMesicniVyzivne2} onChange={handleInputChange} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg outline-none font-bold text-red-800 text-sm" />
                  </div>
                </div>
              )}

              {/* SEKCE 4: PARAMETRY ŘÍZENÍ A DLUHŮ */}
              {activeTab === 'nezabavitelna' ? (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Parametry exekuce</h3>
                  <div>
                     <Tooltip text="Režim srážky ze dvou třetin se při 4+ exekucích uplatní jen tehdy, pokud jde současně o nejméně čtyři exekuce k vymožení splatných peněžitých pohledávek a plátci mzdy byl doručen exekuční příkaz nebo usnesení obsahující vyrozumění o exekuci srážkami.">
                       <label className="block text-[10px] font-bold text-slate-700 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Počet souběžných exekucí</label>
                     </Tooltip>
                     <select name="pocetExekuci" value={data.pocetExekuci} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                        <option value="1-3">1 až 3 exekuce</option>
                        <option value="4+">4 a více exekucí (usnesení doručeno plátci)</option>
                     </select>
                  </div>
                  <div>
                     <Tooltip text="Nepřednostní pohledávky se zpravidla uspokojují z první třetiny. Přednostní pohledávky se uspokojují ze druhé třetiny a podle potřeby i z první třetiny; výživné má v druhé třetině přednost před ostatními přednostními pohledávkami.">
                       <label className="block text-[10px] font-bold text-slate-700 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Druh pohledávky</label>
                     </Tooltip>
                     <select name="typPohledavky" value={data.typPohledavky} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                        <option value="neprednostni">Nepřednostní (Běžné dluhy, půjčky)</option>
                        <option value="prednostni">Přednostní (Daně, pojistné a vyjmenované veřejnoprávní/náhradové pohledávky)</option>
                        <option value="vyzivne">Běžné/dlužné výživné (Superpřednost)</option>
                     </select>
                  </div>
                  <label className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 w-fit cursor-pointer">
                    <input type="checkbox" name="uplatnitPausalPlatce" checked={data.uplatnitPausalPlatce} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                    <Tooltip text="Zaměstnavatel má právo strhnout si poplatek za to, že za vás srážku účetně zpracovává (max 50 Kč měsíčně). Týká se jen exekucí po 1. 1. 2022. Poplatek se platí ze sražené částky, nesníží to vaši výplatu.">
                      <span className="text-[10px] font-medium text-slate-700 cursor-help border-b border-dotted border-slate-400">Zaměstnavatel uplatňuje paušál 50 Kč.</span>
                    </Tooltip>
                  </label>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-slate-400">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Konfigurace dluhů pro rozvrh</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                       <Tooltip text="Standardní režim je 36 měsíců. Pětiletá varianta (60 měsíců) se použije zejména tehdy, bylo-li dlužníku v posledních 20 letech přiznáno osvobození od placení pohledávek zahrnutých do oddlužení.">
                         <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Délka (Měsíce)</label>
                       </Tooltip>
                       <select name="delkaOddluzeni" value={data.delkaOddluzeni} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                          <option value={36}>36 měs. (Aktuální režim 2026)</option>
                          <option value={60}>60 měs. (Předchozí osvobození v posl. 20 letech / historické)</option>
                       </select>
                     </div>
                     <div>
                       <Tooltip text="Odhadovaný výtěžek z prodeje vašeho nezajištěného majetku (např. auto, chata, pozemek), který insolvenční správce zpeněží. Tyto peníze výrazně zvýší konečné procento uspokojení věřitelů.">
                         <label className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Výtěžek ze zpeněžení majetku</label>
                       </Tooltip>
                       <input type="number" name="vytezekZpenezeni" value={data.vytezekZpenezeni} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg font-bold text-green-900 text-sm" />
                     </div>
                  </div>
                  
                  <div>
                    <Tooltip text="Součet všech vašich běžných dluhů (spotřebitelské úvěry, kreditní karty, nezaplacené faktury), u kterých věřitelé nemají žádnou zástavu. Právě z této částky se na konci počítá, na kolik procent jste dluhy umořili.">
                      <label className="block text-[10px] font-bold text-indigo-700 mb-1 w-fit cursor-help border-b border-dotted border-indigo-400">Nezajištěné dluhy (Základ pro výpočet)</label>
                    </Tooltip>
                    <input type="number" name="dluhyNezajistene" value={data.dluhyNezajistene} onChange={handleInputChange} className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg font-bold text-indigo-900 text-sm" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Tooltip text="Zde zadejte hypotéky, úvěry se zástavou nemovitosti nebo leasingy aut. Tyto dluhy se neplatí z měsíčních srážek ze mzdy, ale uspokojují se primárně z prodeje dané zástavy (např. prodeje bytu).">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Zajištěné dluhy</label>
                      </Tooltip>
                      <input type="number" name="dluhyZajistene" value={data.dluhyZajistene} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <Tooltip text="Například dluhy z úmyslných trestných činů, peněžité tresty nebo náhrady úmyslné škody. Na tyto dluhy se oddlužení nevztahuje – po skončení řízení vám je soud neodpustí a budete je muset doplatit.">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Neosvoboditelné dluhy</label>
                      </Tooltip>
                      <input type="number" name="dluhyNeosvoboditelne" value={data.dluhyNeosvoboditelne} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* PRAVÝ PANEL - Výsledky */}
          <main className={`${activeTab === 'nastaveni' ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4 print:space-y-6 print:col-span-12`}>
            
            {activeTab === 'nastaveni' && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-black mb-6">Referenční parametry (Stav 2026)</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Zákonná minima</h4>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Životní minimum</label><input type="number" value={params.zivotniMinimum} onChange={(e) => setParams({...params, zivotniMinimum: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Normativní nájemné (Standard)</label><input type="number" value={params.normativniNajemne} onChange={(e) => setParams({...params, normativniNajemne: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Energetický paušál</label><input type="number" value={params.energetickyPausal} onChange={(e) => setParams({...params, energetickyPausal: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Odměny a poplatky</h4>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Odměna IS (Jednotlivec vč. hotových výdajů)</label><input type="number" value={params.odmenaSpravceJednotlivec} onChange={(e) => setParams({...params, odmenaSpravceJednotlivec: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Odměna IS (Manželé)</label><input type="number" value={params.odmenaSpravceManzele} onChange={(e) => setParams({...params, odmenaSpravceManzele: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Max. paušál plátci mzdy</label><input type="number" value={params.pausalniNahradaPlatce} onChange={(e) => setParams({...params, pausalniNahradaPlatce: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 pt-4">Zákonné koeficienty a podmínky</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Tooltip text="Procento ze součtu zákonných minim, které tvoří základní nezabavitelnou částku. Pro rok 2026 je to 85 %.">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Koeficient základu (%)</label>
                        </Tooltip>
                        <input type="number" value={params.koeficientZahladu} onChange={(e) => setParams({...params, koeficientZahladu: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                      <div>
                        <Tooltip text="Násobek součtu minim, nad který je zbytek příjmu plně zabavitelný. Pro rok 2026 je to 1,9.">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Násobek pro plně zabav. část</label>
                        </Tooltip>
                        <input type="number" step="0.1" value={params.koeficientZabavitelnosti} onChange={(e) => setParams({...params, koeficientZabavitelnosti: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                      <div className="col-span-2">
                        <Tooltip text="Pevný limit pro uplatnění výjimky u 4 a více exekucí. Pokud dlužník pobírá důchod a třetina je pod touto částkou, sráží se jen jedna třetina. Pro rok 2026 je to 1 089 Kč.">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Max. limit 1/3 pro výjimku u 4+ exekucí (Kč)</label>
                        </Tooltip>
                        <input type="number" value={params.limit4PlusPension} onChange={(e) => setParams({...params, limit4PlusPension: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-100 mt-4 space-y-3">
                      <div>
                        <Tooltip text="Interní orientační práh kalkulačky pro posouzení, zda srážka není zjevně příliš nízká. (Cca 2 200 Kč měsíčně podle veřejné nápovědy justice.cz).">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Minimální splátka v oddlužení (Jednotlivec)</label>
                        </Tooltip>
                        <input type="number" value={params.minSplatkaJednotlivec ?? 2178} onChange={(e) => setParams({...params, minSplatkaJednotlivec: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-red-200 bg-red-50 rounded font-bold" />
                      </div>
                      <div>
                        <Tooltip text="Interní orientační práh kalkulačky pro posouzení, zda srážka u manželů není zjevně příliš nízká.">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Minimální splátka v oddlužení (Manželé)</label>
                        </Tooltip>
                        <input type="number" value={params.minSplatkaManzele ?? 3267} onChange={(e) => setParams({...params, minSplatkaManzele: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-red-200 bg-red-50 rounded font-bold" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'nezabavitelna' && (
              <div className="space-y-4">
                <div className="hidden print:block mb-6">
                  <h2 className="text-2xl font-bold border-b pb-2">Report: Exekuční srážky ze mzdy (2026)</h2>
                  <div className="flex gap-8 mt-4 text-sm">
                     <p><strong>Základ příjmů:</strong> {results.totalPrijem1.toLocaleString()} Kč</p>
                     <p><strong>Režim srážky:</strong> {results.ex.forceTwoThirds ? 'Ze dvou třetin (Přednostní/4+)' : 'Z jedné třetiny (Nepřednostní)'}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="K výplatě dlužníkovi" 
                    titleTooltip="Celkem, co vám po srážce zůstane. U nepřednostních exekucí zpravidla nezabavitelná částka + druhá a třetí třetina; u přednostních nebo v režimu 4+ nezabavitelná částka + třetí třetina; navíc se mohou přičíst zákonem nepostižitelné příjmy."
                    value={results.ex.kVyplate} 
                    color="green" 
                    subtitle="Částka k výplatě po odečtení srážek."
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-green-800">
                        <Tooltip text="Základní částka z vaší mzdy, na kterou exekutor nesmí sáhnout. Odvíjí se od životního minima a počtu vyživovaných osob.">
                          <span className="cursor-help border-b border-dotted border-green-400">Zákonné minimum (mzda)</span>
                        </Tooltip>
                        <strong>{results.ex.legalniMinimum.toLocaleString()} Kč</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-green-800">
                        <Tooltip text="Peníze (např. dávky v hmotné nouzi), které nepodléhají exekuci a přičtou se k vaší konečné výplatě.">
                          <span className="cursor-help border-b border-dotted border-green-400">Nepostižitelné dávky</span>
                        </Tooltip>
                        <strong>{data.chranenePrijmy1.toLocaleString()} Kč</strong>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-green-700 pt-1 mt-1 border-t border-green-200/50">
                        <Tooltip text={`Pokud zbytek příjmu přesáhne částku ${results.ex.hranicePlneZabavitelna.toLocaleString()} Kč, tak vše nad tuto hranici je už plně zabaveno a odešle se bez milosti exekutorovi.`}>
                          <span className="cursor-help border-b border-dotted border-green-400">Limit plně zabavitelné části</span>
                        </Tooltip>
                        <strong>{results.ex.hranicePlneZabavitelna.toLocaleString()} Kč</strong>
                      </div>
                    </div>
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Zákonná srážka" 
                    titleTooltip="Částka, kterou vám zaměstnavatel ze zákona srazí. U nepřednostních dluhů tvoří jednu třetinu zbytku mzdy, u přednostních dluhů (nebo při nejméně 4 exekucích za splnění zákonných podmínek) tvoří dvě třetiny. Část srážky může být předtím použita na paušální náhradu plátci mzdy."
                    value={results.ex.srazkaCista} 
                    color="red" 
                    subtitle={results.ex.forceTwoThirds ? "Uplatněna srážka ze DVOU třetin zbytku." : "Uplatněna srážka z JEDNÉ třetiny zbytku."}
                  >
                    <div className="flex justify-between items-center text-xs text-red-800">
                      <Tooltip text="Poplatek zaměstnavateli za provádění srážky. Strhává se přímo z částky pro exekutora, nesnižuje to vaši čistou výplatu.">
                        <span className="cursor-help border-b border-dotted border-red-400">Náhrada zaměstnavateli</span>
                      </Tooltip>
                      <strong>{results.ex.nahradaPlatci} Kč</strong>
                    </div>
                    {results.ex.exception4PlusApplied && (
                       <div className="mt-2 p-2 bg-red-100 rounded text-[10px] text-red-800 font-bold leading-tight print:border print:border-red-300">
                         Výjimka: Dlužník pobírá důchod a třetina je pod fixním limitem ({params.limit4PlusPension} Kč). Sráží se jen z 1/3 zbytku bez ohledu na 4+ exekucí.
                       </div>
                    )}
                  </AnalyticCard>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 print:break-inside-avoid">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Layers size={16} /> Rozpad na třetiny
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                     <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <Tooltip text="Základní částka, která nesmí být sražena. Pro rok 2026 činí 85 % ze součtu životního minima a normativů + přidává se 1/4 za každou vyživovanou osobu.">
                         <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 cursor-help border-b border-dotted border-slate-400 w-fit">Nezab. základ</p>
                       </Tooltip>
                       <p className="font-black text-slate-800 text-lg">{results.ex.legalniMinimum.toLocaleString()}</p>
                       <p className="text-[8px] text-slate-400 mt-1">Započítán partner: {results.ex.partnerZapocitan ? 'ANO' : 'NE'}</p>
                     </div>
                     <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <Tooltip text="Čistý příjem po odečtení nezabavitelného základu. Pokud je tento zbytek obrovský, dělí se na třetiny maximálně do částky stanoveného limitu.">
                         <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 cursor-help border-b border-dotted border-slate-400 w-fit">Zbytek k dělení</p>
                       </Tooltip>
                       <p className="font-black text-slate-800 text-lg">{results.ex.zbytekKDeleni.toLocaleString()}</p>
                     </div>
                     <div className="p-3 bg-amber-50 rounded-lg border-l-2 border-amber-400">
                       <Tooltip text="Výsledek dělení 'zbytku' třemi (nebo limitu třemi). První třetina jde vždy na dluhy, třetí třetina vám zůstane k výplatě. Osud prostřední (druhé) třetiny závisí na typu dluhu.">
                         <p className="text-[9px] text-amber-800 uppercase font-bold mb-1 cursor-help border-b border-dotted border-amber-600 w-fit">Hodnota 1/3</p>
                       </Tooltip>
                       <p className="font-black text-amber-900 text-lg">{results.ex.tretina.toLocaleString()}</p>
                     </div>
                     <div className="p-3 bg-red-50 rounded-lg border-l-2 border-red-400">
                       <Tooltip text={`Pokud zbytek příjmu přesáhne částku ${results.ex.hranicePlneZabavitelna.toLocaleString()} Kč, tak vše nad tuto hranici je už plně zabaveno a odešle se bez milosti exekutorovi.`}>
                         <p className="text-[9px] text-red-800 uppercase font-bold mb-1 cursor-help border-b border-dotted border-red-600 w-fit">Plně zabavitelné</p>
                       </Tooltip>
                       <p className="font-black text-red-900 text-lg">{results.ex.plneZabavitelna.toLocaleString()}</p>
                     </div>
                  </div>
                  
                  {data.typPohledavky === 'vyzivne' && (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-3">
                      <Gavel className="text-indigo-500 shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="text-[10px] font-black text-indigo-900 uppercase">Maximální přednostní fond</p>
                        <p className="text-[10px] text-indigo-800 mt-1">Výživné se ve druhé třetině uspokojuje před ostatními přednostními pohledávkami a teprve když druhá třetina nestačí, jde se do první třetiny podle pravidel rozvrhu. Maximální fond, ze kterého se přednostně uspokojuje výživné a další přednostní pohledávky, činí <strong>{results.ex.maxPrednostniFond.toLocaleString()} Kč</strong>.</p>
                      </div>
                    </div>
                  )}

                  {/* VÝUKOVÝ MATEMATICKÝ BLOK - EXEKUCE */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Matematický postup výpočtu:</p>
                    <div className="space-y-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto whitespace-nowrap">
                      {renderMathStep1(results.ex, params)}
                      <p>2. <strong className="text-slate-700">Zbytek mzdy:</strong> {results.ex.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.ex.legalniMinimum.toLocaleString()} (Nezab. částka) = {Math.max(0, results.ex.zbytekMzdyRaw).toLocaleString()} Kč</p>
                      {results.ex.zbytekMzdyRaw > 0 && (
                        <>
                          <p>3. <strong className="text-slate-700">Hodnota 1/3:</strong> {results.ex.zbytekKDeleni.toLocaleString()} (Část do limitu) ÷ 3 = {results.ex.tretina.toLocaleString()} Kč (zbytek {results.ex.zaokrouhlovaciZbytek} Kč dlužníkovi)</p>
                          <p>4. <strong className="text-slate-700">Srážka:</strong> {results.ex.forceTwoThirds ? '2' : '1'} × {results.ex.tretina.toLocaleString()} ({results.ex.forceTwoThirds ? 'Přednostní' : 'Nepřednostní'}) + {results.ex.plneZabavitelna.toLocaleString()} (Nad limit) = {results.ex.srazka.toLocaleString()} Kč</p>
                          <p>5. <strong className="text-slate-700">K výplatě:</strong> {results.ex.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.ex.srazka.toLocaleString()} (Srážka){data.chranenePrijmy1 > 0 ? ` + ${data.chranenePrijmy1.toLocaleString()} (Chráněné dávky)` : ''} = {results.ex.kVyplate.toLocaleString()} Kč</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'jednotlivec' && (
              <div className="space-y-4">
                <div className="hidden print:block mb-6">
                  <h2 className="text-2xl font-bold border-b pb-2">Report: Prognóza oddlužení (Jednotlivec)</h2>
                </div>

                {results.rizikoNepovoleniJ && (
                  <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 print:border-red-400 print:bg-white">
                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-xs font-bold text-red-900 uppercase">Riziko nepovolení oddlužení</p>
                      <p className="text-[11px] text-red-800 mt-1">
                        Vypočtená měsíční srážka nedosahuje nastaveného orientačního minima (<strong>{params.minSplatkaJednotlivec.toLocaleString()} Kč</strong> měsíčně), nebo po odečtení odměny správce a běžného výživného <strong>nezbývá nic pro nezajištěné věřitele</strong>. K povolení oddlužení soudem bude pravděpodobně nutné doložit dodatečný příjem (např. darovací smlouvou nebo smlouvou o důchodu).
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Zákonná měsíční srážka" 
                    titleTooltip="Celková částka sražená z vašeho příjmu. V oddlužení se sráží nejpřísnějším možným způsobem, tedy 'ze dvou třetin', abyste splatili co nejvíce dluhů."
                    value={results.insJ.srazka} 
                    color="slate" 
                    subtitle="Sráží se vždy jako pro přednostní pohledávky."
                  >
                    <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2 mb-2">
                      <Tooltip text="Povinná měsíční odměna a paušální náhrada insolvenčnímu správci. Odečte se jako úplně první položka z vaší celkové srážky.">
                        <span className="text-slate-500 cursor-help border-b border-dotted border-slate-400">Odměna správce (IS)</span>
                      </Tooltip>
                      <strong className="text-slate-700">-{params.odmenaSpravceJednotlivec} Kč</strong>
                    </div>
                    {data.bezneMesicniVyzivne1 > 0 && (
                       <div className="flex justify-between items-center text-xs text-red-600 bg-red-50 p-1.5 rounded">
                        <Tooltip text="Pokud platíte běžné výživné, insolvenční správce ho rovnou zaplatí z vaší měsíční srážky (přednostně před ostatními věřiteli).">
                          <span className="flex items-center gap-1 cursor-help border-b border-dotted border-red-400"><Gavel size={12}/> Průběžné výživné</span>
                        </Tooltip>
                        <strong>-{data.bezneMesicniVyzivne1} Kč</strong>
                      </div>
                    )}
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Orientačně pro nezajištěné věřitele" 
                    titleTooltip="Částka, která z vaší srážky zbyde pro samotné splátky dluhů na úvěrech a půjčkách poté, co se z ní ukrojí peníze pro správce a na výživné."
                    value={results.proVeriteleJ} 
                    color="indigo" 
                    subtitle="Zbytek po odečtení odměny IS a běžného výživného."
                  >
                    <div className="flex justify-between items-center text-[11px] text-green-800 bg-green-50 p-2.5 rounded mt-2 border border-green-100">
                      <Tooltip text="To, z čeho budete reálně během oddlužení žít. Je to zbytek výplaty po provedení srážky, ke kterému se přičtou chráněné sociální dávky.">
                        <span className="cursor-help border-b border-dotted border-green-400">Dlužníkovi zůstane (vč. dávek)</span>
                      </Tooltip>
                      <strong className="text-sm">{results.insJ.kVyplate.toLocaleString()} Kč</strong>
                    </div>
                  </AnalyticCard>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 print:break-inside-avoid">
                   {/* VÝUKOVÝ MATEMATICKÝ BLOK - INSOLVENCE JEDNOTLIVEC */}
                   <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Matematický postup výpočtu srážky:</p>
                   <div className="space-y-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto whitespace-nowrap mb-6">
                     {renderMathStep1(results.insJ, params)}
                     <p>2. <strong className="text-slate-700">Zbytek mzdy:</strong> {results.insJ.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.insJ.legalniMinimum.toLocaleString()} (Nezab. částka) = {Math.max(0, results.insJ.zbytekMzdyRaw).toLocaleString()} Kč</p>
                     {results.insJ.zbytekMzdyRaw > 0 && (
                       <>
                         <p>3. <strong className="text-slate-700">Hodnota 1/3:</strong> {results.insJ.zbytekKDeleni.toLocaleString()} (Část do limitu) ÷ 3 = {results.insJ.tretina.toLocaleString()} Kč</p>
                         <p>4. <strong className="text-slate-700">Srážka:</strong> 2 × {results.insJ.tretina.toLocaleString()} (Oddlužení bere 2/3) + {results.insJ.plneZabavitelna.toLocaleString()} (Nad limit) = {results.insJ.srazka.toLocaleString()} Kč</p>
                         <p>5. <strong className="text-slate-700">K výplatě:</strong> {results.insJ.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.insJ.srazka.toLocaleString()} (Srážka){data.chranenePrijmy1 > 0 ? ` + ${data.chranenePrijmy1.toLocaleString()} (Chráněné dávky)` : ''} = {results.insJ.kVyplate.toLocaleString()} Kč</p>
                       </>
                     )}
                   </div>

                   <div className="bg-slate-900 p-6 rounded-xl shadow-sm text-white flex flex-col justify-between print:bg-white print:border print:text-black">
                     <div>
                       <Tooltip text="Jde o orientační procento, kolik může být při zadaném příjmu a zpeněžení uhrazeno nezajištěným věřitelům. Po novele se neposuzuje jen „pevné procento“, ale i individuálně stanovený cíl a příjmový potenciál dlužníka.">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 cursor-help border-b border-dotted border-blue-500 w-fit print:text-gray-600 print:border-none">Modelové uspokojení</p>
                       </Tooltip>
                       <p className="text-[11px] text-slate-400 mb-3 print:text-gray-800">Nezajištěných věřitelů (Rozvrh {data.delkaOddluzeni} měsíců + Zpeněžení {data.vytezekZpenezeni} Kč)</p>
                     </div>
                     <div>
                       <div className="text-4xl font-black text-white tracking-tighter mb-1 print:text-black">
                         {Number.isFinite(results.uspokojeniJ) ? results.uspokojeniJ.toFixed(1) : 0} %
                       </div>
                       <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2 print:border-gray-200 print:text-gray-600">
                         Odpovídá úhradě {Math.round(results.celkemProVeriteleJ).toLocaleString()} Kč ze základu {data.dluhyNezajistene.toLocaleString()} Kč.
                       </div>
                     </div>
                   </div>

                   <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 mt-4 print:bg-white">
                     <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                       <AlertCircle size={14} /> Mimořádné vlivy
                     </p>
                     <ul className="text-[10px] text-amber-900 space-y-2 leading-relaxed">
                       <li>• Výpočet je orientační. Nezahrnuje jiné přednostní položky (např. dle § 390a) ani změny příjmů či dary.</li>
                       {data.dluhyZajistene > 0 && <li>• <strong>Zajištěné dluhy ({data.dluhyZajistene.toLocaleString()} Kč):</strong> Uspokojují se přednostně z prodeje zástavy.</li>}
                       {data.dluhyNeosvoboditelne > 0 && <li>• <strong>Neosvoboditelné dluhy ({data.dluhyNeosvoboditelne.toLocaleString()} Kč):</strong> Budete je muset doplatit i po případném osvobození!</li>}
                     </ul>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'manzele' && (
              <div className="space-y-4">
                <div className="hidden print:block mb-6">
                  <h2 className="text-2xl font-bold border-b pb-2">Report: Prognóza oddlužení (Manželé)</h2>
                </div>

                {results.rizikoNepovoleniM && (
                  <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 print:border-red-400 print:bg-white">
                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <p className="text-xs font-bold text-red-900 uppercase">Riziko nepovolení oddlužení</p>
                      <p className="text-[11px] text-red-800 mt-1">
                        Společná měsíční srážka obou manželů nedosahuje nastaveného orientačního minima pro manžele (<strong>{params.minSplatkaManzele.toLocaleString()} Kč</strong>), nebo po odečtení odměny správce a běžného výživného <strong>nezbývá z celkové srážky nic pro nezajištěné věřitele</strong>. K povolení oddlužení soudem bude pravděpodobně nutné doložit dodatečný příjem.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Celková společná srážka" 
                    titleTooltip="Sečtené srážky obou manželů. Manželům se v insolvenci sráží oběma nejpřísnějším způsobem, z tohoto jednoho balíku pak odtékají splátky."
                    value={results.srazkaCelkemM} 
                    color="slate" 
                    subtitle="Sloučená srážka obou manželů (počítáno samostatně)."
                  >
                    <div className="flex justify-between items-center text-xs">
                      <Tooltip text="Rozpad, kolik se z celkové sumy přesně strhne každému z manželů z jeho vlastní výplaty.">
                        <span className="text-slate-500 cursor-help border-b border-dotted border-slate-400">Srážka Manžel A / Manžel B</span>
                      </Tooltip>
                      <strong className="text-slate-700">{results.insM_A.srazka.toLocaleString()} / {results.insM_B.srazka.toLocaleString()} Kč</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 border-t pt-2">
                      <Tooltip text="Poplatek pro insolvenčního správce (1,5násobek poplatku jednotlivce), který se hradí přednostně.">
                        <span className="cursor-help border-b border-dotted border-slate-400">Odměna IS (Manželé)</span>
                      </Tooltip>
                      <span>-{params.odmenaSpravceManzele} Kč</span>
                    </div>
                    {(data.bezneMesicniVyzivne1 > 0 || data.bezneMesicniVyzivne2 > 0) && (
                      <div className="flex justify-between items-center text-[10px] text-red-500 mt-1">
                        <Tooltip text="Výživné se i v oddlužení hradí přednostně před běžnými dluhy.">
                          <span className="cursor-help border-b border-dotted border-red-300">Přednostní výživné celkem</span>
                        </Tooltip>
                        <span>-{data.bezneMesicniVyzivne1 + data.bezneMesicniVyzivne2} Kč</span>
                      </div>
                    )}
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Orientačně pro nezajištěné věřitele" 
                    titleTooltip="Částka, která z vaší společné srážky zbude pro věřitele na dluhy a úvěry (poté, co se strhne peníz pro správce a výživné)."
                    value={results.proVeriteleM} 
                    color="indigo" 
                    subtitle="Společná částka k rozvrhu po odečtení priorit."
                  >
                    <div className="flex justify-between items-center text-[11px] text-green-800 bg-green-50 p-2.5 rounded mt-2 border border-green-100">
                      <Tooltip text="Sečtený čistý příjem rodiny, který vám s manželem po insolvenčních srážkách přijde na bankovní účty, abyste z něj hradili chod domácnosti.">
                        <span className="cursor-help border-b border-dotted border-green-400">Rodině zůstane k výplatě celkem</span>
                      </Tooltip>
                      <strong className="text-sm">{results.kVyplateCelkemM.toLocaleString()} Kč</strong>
                    </div>
                  </AnalyticCard>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 print:break-inside-avoid">
                   <div className="bg-slate-900 p-6 rounded-xl shadow-sm text-white flex flex-col justify-between print:bg-white print:border print:text-black">
                     <div>
                       <Tooltip text="Jde o orientační procento, kolik může být při zadaném příjmu a zpeněžení uhrazeno nezajištěným věřitelům. Po novele se neposuzuje jen „pevné procento“, ale i individuálně stanovený cíl a příjmový potenciál dlužníka.">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 cursor-help border-b border-dotted border-blue-500 w-fit print:text-gray-600 print:border-none">Modelové uspokojení</p>
                       </Tooltip>
                       <p className="text-[11px] text-slate-400 mb-3 print:text-gray-800">Společné dluhy rodiny ({data.delkaOddluzeni} měs. + Zpeněžení {data.vytezekZpenezeni} Kč)</p>
                     </div>
                     <div>
                       <div className="text-4xl font-black text-white tracking-tighter mb-1 print:text-black">
                         {Number.isFinite(results.uspokojeniM) ? results.uspokojeniM.toFixed(1) : 0} %
                       </div>
                       <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2 print:border-gray-200 print:text-gray-600">
                         Odpovídá úhradě {Math.round(results.celkemProVeriteleM).toLocaleString()} Kč ze základu {data.dluhyNezajistene.toLocaleString()} Kč.
                       </div>
                     </div>
                   </div>

                   <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 mt-4 print:bg-white">
                     <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                       <Info size={14} /> Metodika manželů
                     </p>
                     <p className="text-[10px] text-blue-900 leading-relaxed">
                       Srážky se provádějí samostatně z příjmu každého manžela. Manželé na sebe navzájem čtvrtinu nezabavitelné částky <strong>neuplatňují</strong>, protože jsou dlužníky ve stejném řízení. Započítávají se pouze společně vyživované děti u obou z nich (plus děti individuální).
                     </p>
                   </div>
                </div>
              </div>
            )}

            <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-relaxed print:text-black print:border-none print:bg-transparent">
              <strong>Doložka o vyloučení odpovědnosti:</strong> Kalkulačka počítá s právním stavem pro mzdy vyplacené v roce 2026 (podle o. s. ř. a nařízení vlády č. 595/2006 Sb.). Výsledky mají pouze orientační charakter. U exekucí vrací kalkulačka celkovou měsíční srážku; nerozpočítává pořadí více souběžných pohledávek mezi jednotlivé věřitele. U oddlužení je procento uspokojení modelem a nezohledňuje všechny jednorázové náklady řízení, mimořádné příjmy ani změny mzdy. Složité souběhy více plátců (např. několik částečných úvazků), detailní pořadí exekucí či zvláštní režimy odstupného a dlužné mzdy vyžadují individuální posouzení účtárny či soudu.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default App;