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
  { label: 'Osobní přístup', value: 'Každá návštěva podle aktuální potřeby' },
  { label: 'Komorní péče', value: 'Čas vedený bez zbytečného spěchu' },
  { label: 'Rezervace', value: 'Volné termíny vypisované průběžně' },
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
  title: 'Místo, kde se pečuje pozorně',
  description:
    'Každá návštěva v PP Studio vychází z aktuální potřeby pleti, vašeho stylu a toho, jak se chcete cítit.',
  primaryCta: { href: '/rezervace', label: 'Vybrat termín' },
  secondaryCta: { href: '/sluzby', label: 'Zobrazit služby' },
};

export const aboutContent = {
  heroTitle: 'Péče, která začíná pozorností',
  heroDescription:
    'V PP Studio je pro mě důležité, aby každá návštěva odpovídala tomu, co právě potřebuje vaše pleť, výraz i celkový pocit ze sebe.',
  story: [
    'Věřím, že dobrá péče začíná tím, že vás někdo opravdu vnímá. Proto si dávám záležet na tom, aby zvolená služba odpovídala tomu, co vám bude sedět právě teď.',
    'Nejde mi o univerzální postup ani o rychlý efekt za každou cenu. Důležitý je pro mě promyšlený výběr péče, pečlivé provedení a výsledek, ve kterém se budete cítit dobře.',
  ],
  values: [
    {
      title: 'Pozornost',
      description: 'Každá návštěva má vlastní tempo a vlastní důvod. Podle toho volím průběh i doporučení.',
    },
    {
      title: 'Jistota',
      description: 'Chci, abyste se v průběhu celé návštěvy cítila klidně, pohodlně a bez nejistoty.',
    },
    {
      title: 'Výsledek',
      description: 'Cílem není nápadnost, ale péče, která je přesná, kultivovaná a dává vám smysl.',
    },
  ],
  galleryGuide: [
    'portrét majitelky v pracovním prostředí',
    'detail salonního prostoru v denním světle',
    'detail produktů a nástrojů v jednotném barevném stylu',
  ],
};

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
        'Volné termíny vypisuji průběžně. V rezervačním přehledu tak uvidíte jen časy, které jsou opravdu k dispozici.',
    },
    {
      question: 'Je možné službu při rezervaci ještě upřesnit?',
      answer:
        'Ano. Pokud si nejste jistá výběrem, zvolte nejbližší variantu a při návštěvě vše společně doladíme.',
    },
    {
      question: 'Jak je to se storno podmínkami?',
      answer: `Rezervaci je možné zrušit nebo přesunout alespoň ${cancellationHours} hodin předem. Přesné znění je vždy dostupné na samostatné stránce storno podmínek.`,
    },
    {
      question: 'Mohu přijít i na první konzultaci bez předchozí zkušenosti?',
      answer:
        'Ano. Pokud jdete poprvé, ráda vás péčí provedu tak, abyste se mohla rozhodovat s klidem a jistotou.',
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
