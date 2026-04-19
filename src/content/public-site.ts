export type HighlightItem = {
  label: string;
  value: string;
};

export type TrustMetric = {
  value: string;
  label: string;
  description: string;
};

export type Service = {
  slug: string;
  name: string;
  category: string;
  priceFrom: string;
  duration: string;
  intro: string;
  description: string;
  idealFor: string[];
  includes: string[];
  results: string[];
  placeholderAssetBrief: string;
  seoDescription: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type ContactItem = {
  label: string;
  value: string;
  href?: string;
  note?: string;
};

export const salonHighlights: HighlightItem[] = [
  { label: 'Individuální konzultace', value: '15 minut před první návštěvou' },
  { label: 'Prostor pro klid', value: 'Jen 1 klientka v čase ošetření' },
  { label: 'Rezervace', value: 'Ručně vypisované volné termíny' },
];

export function buildTrustMetrics(cancellationHours: number): TrustMetric[] {
  return [
    {
      value: '1:1',
      label: 'Soukromá péče',
      description: 'Termíny jsou vedené tak, aby měla klientka klid, soukromí a dostatek času bez spěchu.',
    },
    {
      value: '45-120 min',
      label: 'Délka procedur',
      description: 'Délky služeb jsou navržené realisticky, včetně času na konzultaci, ošetření i doporučení domácí péče.',
    },
    {
      value: `${cancellationHours} h`,
      label: 'Storno okno',
      description: 'Pravidla storna jsou komunikovaná jemně, ale zcela jasně už při rozhodování o rezervaci.',
    },
  ];
}

export const trustMetrics = buildTrustMetrics(48);

export const services: Service[] = [
  {
    slug: 'hloubkove-osetreni-pleti',
    name: 'Hloubkové ošetření pleti',
    category: 'Péče o pleť',
    priceFrom: '1 690 Kč',
    duration: '75 min',
    intro: 'Vyvážené ošetření pro klientky, které chtějí čistou, zklidněnou a viditelně svěží pleť bez agresivního zásahu.',
    description:
      'Procedura kombinuje úvodní diagnostiku, šetrné čištění, exfoliaci, cílené aktivní látky a závěrečnou péči podle aktuálního stavu pleti. Text je záměrně psaný jako realistický placeholder a před spuštěním má být nahrazen finálním brand voice salonu.',
    idealFor: ['smíšená a problematická pleť', 'unavený tón pleti', 'první návštěva se zaměřením na restart rutiny'],
    includes: ['odlíčení a diagnostika pleti', 'šetrná exfoliace nebo ultrazvuková špachtle', 'maska a závěrečný doporučený domácí režim'],
    results: ['pocit čistoty bez pnutí', 'sjednocenější vzhled pleti', 'jasnější doporučení další péče'],
    placeholderAssetBrief: 'Portrét klientky v jemném neutrálním světle, detail pleti a rukou kosmetičky, bez stock póz.',
    seoDescription: 'Hloubkové ošetření pleti s individuální diagnostikou, šetrným čištěním a doporučením domácí péče.',
  },
  {
    slug: 'anti-age-ritual',
    name: 'Anti-age ritual',
    category: 'Prémiové rituály',
    priceFrom: '2 290 Kč',
    duration: '90 min',
    intro: 'Delší rituál zaměřený na komfort, liftingový efekt a podporu zdravě odpočatého vzhledu.',
    description:
      'Součástí je masážní technika, intenzivní sérum a maska zvolená podle potřeb pleti. Obsah je placeholder, ale struktura už odpovídá produkčnímu způsobu prezentace služby.',
    idealFor: ['zralejší pleť', 'ztráta jasu a elasticity', 'klientky hledající delší relaxační zkušenost'],
    includes: ['úvodní konzultace', 'liftingová masáž obličeje a dekoltu', 'prémiová závěrečná péče'],
    results: ['odpočatější vzhled', 'komfort a jemnější textura pleti', 'silnější pocit luxusní péče'],
    placeholderAssetBrief: 'Elegantní detail ošetření obličeje, teplé béžové tóny, ruční práce bez rušivých rekvizit.',
    seoDescription: 'Luxusní anti-age ošetření s masáží, intenzivní péčí a klidným rituálním průběhem.',
  },
  {
    slug: 'laminace-oboci-a-rasy',
    name: 'Laminace obočí a řas',
    category: 'Brow & lash',
    priceFrom: '1 290 Kč',
    duration: '60 min',
    intro: 'Úprava pro upravený, ale přirozený výraz bez každodenního složitého stylingu.',
    description:
      'Služba je koncipovaná jako přehledný vstupní bod pro klientky, které chtějí zvýraznit obličej jemně a bez tvrdého efektu. Finální texty je vhodné později rozdělit podle konkrétní metodiky a používané kosmetiky.',
    idealFor: ['nevýrazné nebo neposlušné obočí', 'řasy bez natočení', 'klientky preferující přirozený výsledek'],
    includes: ['konzultace vhodného tvaru a efektu', 'laminační postup', 'doporučení následné domácí péče'],
    results: ['výraznější rámování obličeje', 'jednodušší ranní rutina', 'upravený vzhled i bez make-upu'],
    placeholderAssetBrief: 'Detail obočí a očí po jemné úpravě, přirozený styling, minimum retuše.',
    seoDescription: 'Laminace obočí a řas pro přirozeně upravený výraz a jednodušší denní rutinu.',
  },
];

export const homepageContent = {
  eyebrow: 'Kosmetický salon s důrazem na detail',
  title: 'Luxusní web, který budí důvěru a vede klientku přirozeně k rezervaci.',
  description:
    'Veřejná část je navržená jako čistý prezentační web pro moderní salon: silná první obrazovka, srozumitelná nabídka služeb, jasné podmínky a obsah připravený pro pozdější doplnění reálných textů i fotografií.',
  primaryCta: { href: '/rezervace', label: 'Rezervovat termín' },
  secondaryCta: { href: '/sluzby', label: 'Prohlédnout služby' },
};

export const aboutContent = {
  heroTitle: 'Klidné místo pro péči, která nepůsobí sériově.',
  heroDescription:
    'Stránka je připravená pro příběh majitelky i samotného prostoru. Texty níže jsou realistické placeholdery a jsou rozdělené tak, aby šly snadno nahradit finálním copywritingem bez zásahu do layoutu.',
  story: [
    'PP Studio je koncipováno jako komorní salon, kde se propojuje odborná péče o pleť s klidnou atmosférou a osobním přístupem. Místo rychlého střídání klientek staví na pečlivě vedeném čase a citlivé komunikaci.',
    'Tato verze webu záměrně používá editovatelnou textovou strukturu. Reálný příběh značky sem lze později doplnit po blocích: filozofie péče, profesní zkušenosti, použité značky a fotografie prostoru.',
  ],
  values: [
    {
      title: 'Jemnost bez neurčitosti',
      description: 'Komunikace působí lehce, ale klientka vždy přesně ví, co služba obsahuje, kolik stojí a jak probíhá rezervace.',
    },
    {
      title: 'Péče na míru',
      description: 'Obsah i budoucí booking flow počítají s tím, že různé služby a různé klientky potřebují odlišné vedení.',
    },
    {
      title: 'Důvěra před prodejem',
      description: 'Na webu mají prioritu jasné informace, reference, podmínky a kontakt, ne agresivní prodejní tlak.',
    },
  ],
  galleryGuide: [
    'portrét majitelky v pracovním prostředí',
    'detail salonního prostoru v denním světle',
    'detail produktů a nástrojů v jednotném barevném stylu',
  ],
};

export const priceNotes = [
  'Ceny jsou uvedené jako realistické placeholdery a před spuštěním je potřeba je ověřit vůči skutečné nabídce salonu.',
  'Pokud se služba rozpadne na více variant, doporučuji zachovat jednu hlavní kartu a detaily rozepsat až na detailu služby.',
  'Akční nabídky a balíčky držte odděleně od základního ceníku, aby byl ceník čitelný i na mobilu.',
];

export function buildContactItems(input: {
  phone: string;
  email: string;
  addressLine: string;
  instagramUrl?: string | null;
}): ContactItem[] {
  return [
    {
      label: 'Telefon',
      value: input.phone,
      href: `tel:${input.phone.replace(/\s+/g, '')}`,
    },
    {
      label: 'E-mail',
      value: input.email,
      href: `mailto:${input.email}`,
    },
    {
      label: 'Adresa salonu',
      value: input.addressLine,
    },
    ...(input.instagramUrl
      ? [
          {
            label: 'Instagram',
            value: input.instagramUrl.replace(/^https?:\/\/(www\.)?/i, ''),
            href: input.instagramUrl,
          } satisfies ContactItem,
        ]
      : [
          {
            label: 'Otevírací režim',
            value: 'Dle vypsaných termínů a individuální domluvy',
          } satisfies ContactItem,
        ]),
  ];
}

export const contactItems = buildContactItems({
  phone: '+420 777 000 000',
  email: 'hello@ppstudio.cz',
  addressLine: 'Masarykova 12, 602 00 Brno',
  instagramUrl: null,
});

export function buildFaqItems(cancellationHours: number): FaqItem[] {
  return [
    {
      question: 'Jak funguje rezervace termínu?',
      answer:
        'Salon publikuje volné termíny ručně. Klientka tak vidí jen skutečně dostupné časy a může si vybrat bez zbytečných slepých míst v kalendáři.',
    },
    {
      question: 'Je možné službu při rezervaci ještě upřesnit?',
      answer:
        'Ano. Web počítá s tím, že některé rezervace začínají výběrem orientační služby a finální doporučení může vzniknout až po krátké konzultaci.',
    },
    {
      question: 'Jak je to se storno podmínkami?',
      answer: `Rezervaci je možné zrušit nebo přesunout alespoň ${cancellationHours} hodin předem. Přesné znění je vždy dostupné na samostatné stránce storno podmínek.`,
    },
    {
      question: 'Mohu přijít i na první konzultaci bez předchozí zkušenosti?',
      answer:
        'Ano. Obsah webu i budoucí booking flow jsou psané tak, aby se na nich dobře orientovala i klientka, která salon navštěvuje poprvé.',
    },
  ];
}

export const faqItems = buildFaqItems(48);

export function buildLegalContent(cancellationHours: number) {
  return {
    cancellation: {
      title: 'Storno podmínky',
      intro:
        'Níže uvedený text je produkčně použitelná struktura připravená pro právní a provozní doplnění podle reálného fungování salonu.',
      sections: [
        {
          title: 'Rušení a změna termínu',
          paragraphs: [
            `Rezervovaný termín je možné bez sankce zrušit nebo přesunout nejpozději ${cancellationHours} hodin před jeho začátkem.`,
            `Při zrušení méně než ${cancellationHours} hodin předem může salon uplatnit storno poplatek podle typu rezervované služby nebo zálohy.`,
          ],
        },
        {
          title: 'Nedostavení se',
          paragraphs: [
            'Pokud se klientka na rezervovaný termín bez omluvy nedostaví, může být při další rezervaci vyžadována záloha nebo může být rezervace odmítnuta.',
          ],
        },
      ],
    },
  terms: {
    title: 'Obchodní podmínky',
    intro:
      'Tato stránka slouží jako přehledný základ pro budoucí finální obchodní podmínky. Doporučuji ji před spuštěním zkontrolovat s právníkem nebo alespoň doplnit přesné identifikační údaje.',
    sections: [
      {
        title: 'Poskytovatel služeb',
        paragraphs: [
          'Do této části doplňte obchodní jméno, IČO, sídlo, kontaktní e-mail a telefon.',
          'Pokud salon funguje jako fyzická osoba podnikající, uveďte i informaci o zápisu v příslušném rejstříku, pokud je relevantní.',
        ],
      },
      {
        title: 'Vznik rezervace',
        paragraphs: [
          'Rezervace vzniká potvrzením vybraného termínu prostřednictvím rezervačního systému nebo individuální domluvou, kterou salon následně potvrdí.',
          'Salon si vyhrazuje právo upravit nabídku služeb, ceny a dostupné termíny, pokud to vyžaduje provozní situace.',
        ],
      },
    ],
  },
  gdpr: {
    title: 'GDPR a ochrana osobních údajů',
    intro:
      'Níže je připravená editovatelná struktura pro zásady zpracování osobních údajů. Text je potřeba finalizovat podle konkrétních procesů salonu, používaných nástrojů a retenčních lhůt.',
    sections: [
      {
        title: 'Jaké údaje zpracováváme',
        paragraphs: [
          'Typicky jde o jméno, telefon, e-mail, údaje spojené s rezervací termínu a případně provozní poznámky potřebné pro bezpečné poskytnutí služby.',
          'Zdravotní nebo citlivé údaje zpracovávejte jen tehdy, pokud jsou skutečně nutné a máte k tomu odpovídající právní základ a interní proces.',
        ],
      },
      {
        title: 'Účel a doba uchování',
        paragraphs: [
          'Údaje slouží především k vyřízení rezervace, komunikaci s klientkou a splnění zákonných povinností.',
          'Retenční dobu je vhodné doplnit zvlášť pro účetní doklady, historii rezervací a marketingovou komunikaci.',
        ],
      },
    ],
    },
  };
}

export const legalContent = buildLegalContent(48);

export const contentStructureGuide = [
  {
    title: 'Homepage',
    items: [
      'hero claim + krátký podnadpis',
      '3 hlavní benefity salonu',
      'výběr top služeb',
      'důvěryhodnost: zkušenosti, přístup, reference',
      'silná CTA na rezervaci',
    ],
  },
  {
    title: 'Služby',
    items: [
      'název služby',
      'krátký výsledek nebo přínos',
      'délka a cena od',
      'pro koho je vhodná',
      'co obsahuje procedura',
    ],
  },
  {
    title: 'Fotografie',
    items: [
      'portrait lifestyle fotografie majitelky',
      'detaily rukou, textur a kosmetického rituálu',
      'celky interiéru bez rušivého nepořádku',
      'sjednocený světelný styl a barevnost',
    ],
  },
  {
    title: 'Důvěryhodnost',
    items: [
      'stručná profesní bio sekce',
      'používané značky nebo přístup k péči',
      'FAQ k první návštěvě',
      'jasné podmínky rezervace a storna',
    ],
  },
] as const;

export function getServiceBySlug(slug: string) {
  return services.find((service) => service.slug === slug);
}
