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

export type LinkItem = {
  href: string;
  label: string;
};

export type AboutProfile = {
  name: string;
  role: string;
  intro: string;
  specialties: string[];
};

export type AboutStorySection = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
};

export type AboutValueItem = {
  title: string;
  description: string;
};

export type AboutApproachSection = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  values: AboutValueItem[];
};

export type AboutExpectationsSection = {
  eyebrow: string;
  title: string;
  description: string;
  brandNote: string;
  items: string[];
  closing: string;
};

export type AboutCtaSection = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: LinkItem;
  secondaryCta: LinkItem;
};

export type AboutContent = {
  profile: AboutProfile;
  story: AboutStorySection;
  approach: AboutApproachSection;
  expectations: AboutExpectationsSection;
  cta: AboutCtaSection;
};

export const salonHighlights: HighlightItem[] = [
  { label: 'Příjemné prostředí', value: 'Klidná péče bez zbytečného spěchu' },
  { label: 'Individuální přístup', value: 'Služba podle aktuální potřeby pleti' },
  { label: 'Online rezervace 24/7', value: 'Termín vyberete v několika krocích' },
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
  eyebrow: 'Kosmetický salon Zlín',
  title: 'PP Studio',
  description:
    'Lash lifting, laminace obočí a ošetření pleti v příjemném prostředí s individuálním přístupem.',
  benefits: ['Příjemné prostředí', 'Individuální přístup', 'Online rezervace 24/7'],
  ctaNote: 'Rychlé online objednání, potvrzení termínu e-mailem.',
  logoImage: {
    src: '/brand/ppstudio-logo.png',
    alt: 'PP Studio logo',
    width: 172,
    height: 172,
  },
  portraitImage: {
    src: '/brand/ppstudio-portrait.jpg',
    alt: 'PP Studio - portrét kosmetičky',
    width: 640,
    height: 960,
  },
  primaryCta: { href: '/rezervace', label: 'Rezervovat termín' },
  secondaryCta: { href: '/cenik', label: 'Zobrazit ceník' },
};

export const aboutContent: AboutContent = {
  profile: {
    name: 'Pavlína Pomykalová',
    role: 'Majitelka PP Studia · Cosmetics & Laminations',
    intro:
      'Vytvořila jsem místo, kde se můžete zastavit, nadechnout a dopřát si chvíli jen pro sebe. Chci, aby návštěva působila příjemně od prvního kontaktu až po výsledek, se kterým budete spokojená i v běžném dni.',
    specialties: ['Lash lifting', 'Laminace obočí', 'Kosmetické ošetření', 'Lymfatická masáž obličeje'],
  },
  story: {
    eyebrow: 'Můj příběh',
    title: 'Profesní cesta, která začala rozhodnutím dělat práci poctivě a osobně.',
    paragraphs: [
      'Moje profesní cesta v beauty světě se začala psát v roce 2024. Právě tehdy jsem se rozhodla v tomto oboru pokračovat naplno a postupně si vybudovat pevný odborný základ.',
      'V roce 2025, po dosažení kvalifikací, jsem zahájila aktivní praxi. Od začátku pro mě bylo důležité vytvářet péči, která není jen o proceduře samotné, ale i o pocitu klidu, jistoty a důvěry.',
    ],
  },
  approach: {
    eyebrow: 'Můj přístup',
    title: 'Péče, která stojí na empatii, přesnosti a výsledku, který vám bude sedět.',
    paragraphs: [
      'Věřím, že obličej je zrcadlem naší duše. Mým cílem je podporovat ženské sebevědomí, ušetřit vám čas v každodenní rutině a nabídnout péči, která prospívá nejen vzhledu, ale i celkovému pocitu.',
      'Ke každé klientce přistupuji s respektem a empatií. Doporučuji jen to, co skutečně dává smysl, funguje v praxi a odpovídá tomu, co od návštěvy očekáváte.',
    ],
    values: [
      {
        title: 'Respekt',
        description: 'Každá návštěva má vlastní tempo. Důležité je, abyste se cítila dobře už v průběhu celé péče.',
      },
      {
        title: 'Empatie',
        description: 'Naslouchám tomu, co chcete změnit, zvýraznit nebo si naopak co nejvíc zjednodušit.',
      },
      {
        title: 'Výsledek',
        description: 'Doporučuji jen služby a postupy, které mají jasný přínos a působí přirozeně i dlouhodobě.',
      },
    ],
  },
  expectations: {
    eyebrow: 'Na co se můžete těšit',
    title: 'Jemná, profesionální péče v prostředí, kde není potřeba nikam spěchat.',
    description:
      'Pracuji s českou kosmetikou FOR LIFE & MADAGA, která vychází z francouzských základů a stojí na kvalitě, šetrnosti a promyšlené profesionální péči.',
    brandNote:
      'Kromě značky samotné je pro mě důležitý i způsob práce: srozumitelný průběh, citlivé doporučení a výsledek, který působí upraveně, ale pořád přirozeně.',
    items: [
      'profesionální péče o pleť podle aktuální potřeby',
      'laminace obočí pro upravený a přirozený výraz',
      'lash lifting pro otevřenější pohled bez každodenní námahy',
      'uvolňovací lymfatická masáž obličeje pro lehkost a komfort',
    ],
    closing:
      'Těším se na každé naše setkání. Praxi lze podpořit vášní, talentem, důsledností, estetickým cítěním i odhodláním, které do každé své práce dávám.',
  },
  cta: {
    eyebrow: 'Rezervace',
    title: 'Pokud vám je tenhle přístup blízký, můžete si rovnou vybrat termín.',
    description:
      'Rezervaci dokončíte online v několika klidných krocích. Pokud si zatím nejste jistá volbou služby, ráda vám pomohu i předem.',
    primaryCta: { href: '/rezervace', label: 'Rezervovat termín' },
    secondaryCta: { href: '/kontakt', label: 'Napsat do studia' },
  },
};

export function buildContactItems(input: {
  phone: string;
  email: string;
  addressLine: string;
  instagramUrl?: string | null;
}): ContactItem[] {
  const mapsQuery = encodeURIComponent(input.addressLine);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return [
    {
      label: 'Telefon',
      value: input.phone,
      href: `tel:${input.phone.replace(/\s+/g, '')}`,
      note: 'Volejte kdykoli během dne, když vám vyhovuje rychlé upřesnění.',
    },
    {
      label: 'E-mail',
      value: input.email,
      href: `mailto:${input.email}`,
      note: 'Napište mi pár vět a doporučím další krok.',
    },
    {
      label: 'Adresa salonu',
      value: input.addressLine,
      href: mapsHref,
      note: 'Otevřete trasu v mapě a dorazíte bez hledání.',
    },
    ...(input.instagramUrl
      ? [
          {
            label: 'Instagram',
            value: input.instagramUrl.replace(/^https?:\/\/(www\.)?/i, ''),
            href: input.instagramUrl,
            note: 'Můžete napsat i přes zprávu na Instagramu.',
          } satisfies ContactItem,
        ]
      : [
          {
            label: 'Otevírací režim',
            value: 'Dle vypsaných termínů a individuální domluvy',
            note: 'Volné časy průběžně aktualizuji v rezervačním přehledu.',
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
      'délka a cena',
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
