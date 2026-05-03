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
  linkLabel?: string;
  linkHref?: string;
};

export type FaqSection = {
  id: string;
  title: string;
  description: string;
  items: FaqItem[];
};

export type LegalSection = {
  id?: string;
  eyebrow?: string;
  title: string;
  paragraphs: string[];
  items?: string[];
  note?: string;
};

export type LegalSummaryCard = {
  title: string;
  value: string;
  description: string;
};

export type CancellationPageContent = {
  title: string;
  intro: string;
  ctaPrompt: string;
  contactCardTitle: string;
  contactCardDescription: string;
  contactCardNote: string;
  contactItems: Array<{ label: string; value: string; href: string }>;
  summaryTitle: string;
  summaryCards: LegalSummaryCard[];
  sections: LegalSection[];
  footerNote: string;
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
  eyebrow: string;
  headline: string;
  intro: string;
  primaryCta: LinkItem;
  secondaryCta: LinkItem;
  badges: string[];
  image: {
    src: string;
    alt: string;
    width: number;
    height: number;
  } | null;
};

export type AboutBenefitItem = {
  title: string;
  description?: string;
};

export type AboutWhyChooseMeSection = {
  eyebrow: string;
  title: string;
  description?: string;
  items: AboutBenefitItem[];
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
  intro: string;
  values: AboutValueItem[];
};

export type AboutExpectationsSection = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
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
  whyChooseMe: AboutWhyChooseMeSection;
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
      value: `${cancellationHours} h předem`,
      label: 'Změna nebo zrušení termínu',
      description: `Termín můžete upravit nebo zrušit nejpozději ${cancellationHours} předem.`,
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
    eyebrow: 'O mně',
    headline: 'Péče, ve které se můžete cítit dobře',
    intro:
      'V PP Studiu najdete klidný prostor pro kosmetické ošetření, lash & brow služby a masáž obličeje s osobním přístupem a přirozeným výsledkem.',
    primaryCta: { href: '/rezervace', label: 'Rezervovat termín' },
    secondaryCta: { href: '/kontakt', label: 'Napsat do studia' },
    badges: ['Lash lifting', 'Laminace obočí', 'Kosmetické ošetření', 'Lymfatická masáž obličeje'],
    image: {
      src: '/brand/ppstudio-portrait.jpg',
      alt: 'Pavlína Pomykalová v prostředí PP Studia',
      width: 640,
      height: 960,
    },
  },
  whyChooseMe: {
    eyebrow: 'Proč právě PP Studio',
    title: 'Proč klientky volí PP Studio',
    description:
      'Klidná péče, která šetří čas, respektuje vaši přirozenost a dává prostor odpočinku.',
    items: [
      {
        title: 'Rána s méně starostmi',
        description:
          'Lash lifting a laminace obočí pomáhají upravit výraz tak, aby každodenní rutina byla jednodušší a rychlejší.',
      },
      {
        title: 'Doporučení podle vás',
        description:
          'Každou službu vybírám podle aktuální potřeby pleti, vašeho stylu a výsledku, který vám má opravdu sedět.',
      },
      {
        title: 'Chvíle klidu pro vás',
        description:
          'Péče u mě není jen o výsledku, ale i o průběhu. Chci, abyste se cítila příjemně od začátku do konce.',
      },
    ],
  },
  story: {
    eyebrow: 'Můj příběh',
    title: 'Moje cesta v beauty oboru začala v roce 2024',
    paragraphs: [
      'Po získání potřebných kvalifikací jsem začala budovat PP Studio jako místo, kde má péče jasný smysl, klidný průběh a osobní přístup. Od začátku je pro mě důležité spojit pečlivou techniku s přirozeným výsledkem a prostředím, ve kterém se klientka cítí dobře.',
    ],
  },
  approach: {
    eyebrow: 'Můj přístup',
    title: 'Můj přístup stojí na pečlivosti, klidu a osobním doporučení',
    intro:
      'Každé ošetření vedu s respektem k tomu, co vaše pleť i výraz skutečně potřebují. Nejde mi o rychlé univerzální řešení, ale o péči, která vám bude sedět v běžném dni.',
    values: [
      {
        title: 'Pečlivost',
        description: 'Každé ošetření vedu s důrazem na detail, hygienu, komfort a přirozený výsledek.',
      },
      {
        title: 'Citlivý přístup',
        description: 'Naslouchám tomu, co si přejete změnit, zvýraznit nebo zjednodušit v běžné péči.',
      },
      {
        title: 'Rozvoj',
        description: 'Průběžně se vzdělávám a vybírám postupy, které mají smysl v praxi i ve výsledku.',
      },
    ],
  },
  expectations: {
    eyebrow: 'FOR LIFE & MADAGA',
    title: 'Profesionální péče s českou kosmetikou',
    paragraphs: [
      'Při kosmetických ošetřeních pracuji s českou značkou FOR LIFE & MADAGA, která staví na šetrnosti, kvalitních recepturách a profesionálním přístupu k pleti.',
      'U mě se můžete těšit na:',
    ],
    items: [
      'Kosmetické ošetření podle aktuální potřeby pleti.',
      'Lash lifting a laminaci obočí pro upravený výraz.',
      'Lymfatickou masáž obličeje pro uvolnění a lehkost.',
    ],
    closing:
      'Cílem je péče, která působí upraveně, přirozeně a dává smysl právě vám.',
  },
  cta: {
    eyebrow: 'Rezervace',
    title: 'Pokud vám je tenhle přístup blízký, můžete si rovnou vybrat termín.',
    description:
      'Rezervaci dokončíte online v několika klidných krocích. A pokud si zatím nejste jistá volbou služby, ráda vám pomohu předem.',
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
  const mapsHref =
    'https://www.google.com/maps/place/Kosmetika+%7C+Pavl%C3%ADna+Pomykalov%C3%A1/@49.2243341,17.6666905,17z/data=!3m1!4b1!4m6!3m5!1s0x471373237e15d51f:0x512b1d491baa6ee7!8m2!3d49.2243341!4d17.6666905!16s%2Fg%2F11n56ny14y';

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
  phone: '+420 732 856 036',
  email: 'info@ppstudio.cz',
  addressLine: 'Sadová 2, 760 01 Zlín',
  instagramUrl: null,
});

export function buildFaqSections(cancellationHours: number): FaqSection[] {
  return [
    {
      id: 'rezervace',
      title: 'Rezervace',
      description: 'Krátce a prakticky: jak si vybrat termín a co dělat, když si nejste jistá službou.',
      items: [
        {
          question: 'Jak funguje rezervace termínu?',
          answer:
            'Volné termíny vypisuji průběžně a v rezervačním přehledu uvidíte jen časy, které jsou opravdu k dispozici. Po odeslání rezervace vám studio termín ještě potvrdí, aby bylo vše jasné a bez nejistoty.',
        },
        {
          question: 'Mohu se objednat i bez přesného výběru služby?',
          answer:
            'Ano. Pokud si nejste jistá, vyberte službu, která je vašemu přání nejblíže, a do poznámky klidně napište, s čím potřebujete poradit. Před začátkem návštěvy vše společně doladíme.',
        },
        {
          question: 'Kdy mi přijde potvrzení rezervace?',
          answer:
            'Po odeslání rezervace dostanete zprávu, že studio váš požadavek přijalo. Finální potvrzení přijde po kontrole termínu, obvykle co nejdříve během provozního dne.',
        },
        {
          question: 'Mohu rezervaci změnit?',
          answer:
            'Ano. Jakmile víte, že vám termín nevyhovuje, ozvěte se prosím co nejdříve a zkusíme spolu najít jiný čas. Čím dříve dáte vědět, tím snáz se podaří termín upravit.',
        },
      ],
    },
    {
      id: 'prvni-navsteva',
      title: 'První návštěva',
      description: 'Odpovědi pro chvíli, kdy jdete poprvé a nechcete tápat v tom, co vás čeká.',
      items: [
        {
          question: 'Co mě čeká při první návštěvě?',
          answer:
            'Na začátku si v klidu řekneme, co řešíte, jaká je vaše běžná péče a co od návštěvy čekáte. Potom navážeme samotným ošetřením a na závěr dostanete jednoduché doporučení pro domácí péči.',
        },
        {
          question: 'Mohu přijít, i když nemám zkušenosti?',
          answer:
            'Ano, nemusíte se bát. Vše vysvětlím průběžně tak, abyste se cítila v klidu i bez předchozí zkušenosti.',
        },
        {
          question: 'Musím vědět přesně, co chci?',
          answer:
            'Ne. Pokud si nejste jistá, stačí říct, co byste chtěla zlepšit nebo jaký výsledek očekáváte. Vhodný postup pak zvolíme spolu.',
        },
        {
          question: 'Mohu službu na místě upravit podle stavu pleti?',
          answer:
            'Ano, pokud to dává smysl pro vaši pleť i časovou rezervu. Před ošetřením společně zhodnotíme aktuální stav a domluvíme péči tak, aby byla příjemná a bezpečná.',
        },
        {
          question: 'Jak často chodit na kosmetiku?',
          answer:
            'Záleží na typu pleti, cíli péče i domácí rutině. U pravidelné péče se často osvědčuje návštěva přibližně jednou za 4 až 6 týdnů, ale přesnější rytmus domluvíme podle toho, co vaše pleť aktuálně potřebuje.',
        },
      ],
    },
    {
      id: 'prakticke-otazky',
      title: 'Praktické otázky',
      description: 'To nejdůležitější před odchodem z domu, abyste věděla, co čekat a co vůbec řešit nemusíte.',
      items: [
        {
          question: 'Jak dlouho ošetření trvá?',
          answer:
            'Podle zvolené služby obvykle počítejte přibližně s 45 až 120 minutami. Orientační délku vždy uvidíte už při výběru termínu.',
        },
        {
          question: 'Můžu přijít nalíčená?',
          answer:
            'Ano, klidně přijďte tak, jak běžně chodíte. Před ošetřením vše potřebné šetrně odlíčíme.',
        },
        {
          question: 'Co si vzít s sebou?',
          answer:
            'Nic speciálního nepotřebujete. Stačí přijít v klidu na domluvený čas, o vše ostatní bude postaráno.',
        },
        {
          question: 'Kde přesně studio najdu?',
          answer:
            'PP Studio najdete na adrese Sadová 2, 760 01 Zlín. Na kontaktní stránce je připravený odkaz do Google Maps, abyste si mohla trasu pohodlně otevřít ještě před cestou.',
          linkLabel: 'Otevřít kontakt',
          linkHref: '/kontakt',
        },
        {
          question: 'Dá se u studia zaparkovat?',
          answer:
            'Ano, v okolí Sadové ulice je několik veřejných možností parkování. Na kontaktní stránce najdete krátké doporučení podle vzdálenosti, ceny a pohodlí včetně orientačních sazeb.',
          linkLabel: 'Zobrazit parkování',
          linkHref: '/kontakt#parkovani',
        },
      ],
    },
    {
      id: 'komfort-a-prubeh',
      title: 'Komfort a průběh',
      description: 'Nejčastější obavy kolem pohodlí, citlivosti a toho, jak se během návštěvy budete cítit.',
      items: [
        {
          question: 'Bolí ošetření?',
          answer:
            'Ve většině případů je ošetření šetrné a komfortní. Pokud by vám cokoliv nebylo příjemné, stačí říct a průběh hned upravíme.',
        },
        {
          question: 'Bolí úprava obočí?',
          answer:
            'Úprava obočí může být lehce citlivá hlavně při vytrhávání chloupků, ale pracuji šetrně a průběžně sleduji vaše pohodlí. Pokud víte, že jste citlivější, řekněte mi to předem a postup přizpůsobíme.',
        },
        {
          question: 'Jak dlouho vydrží barvení obočí?',
          answer:
            'Obvykle počítejte přibližně s 2 až 4 týdny. Výdrž ovlivňuje typ pokožky, domácí péče, odličování i to, jak rychle se obočí přirozeně obnovuje.',
        },
        {
          question: 'Je kosmetické ošetření vhodné pro citlivou pleť?',
          answer:
            'Ano, jen je potřeba citlivost zohlednit už při konzultaci. Pokud víte o reakcích, alergiích nebo aktuálním podráždění, řekneme si to předem a zvolíme jemnější postup i vhodné přípravky.',
        },
      ],
    },
    {
      id: 'organizace',
      title: 'Organizace',
      description: 'Malé provozní situace, které se stávají běžně a není potřeba z nich mít stres.',
      items: [
        {
          question: 'Co když se opozdím?',
          answer:
            'Když to půjde, počkáme na vás. Při větším zpoždění ale může být potřeba službu zkrátit nebo domluvit jiný termín, aby nenavazovaly další rezervace.',
        },
        {
          question: 'Jak probíhá platba?',
          answer:
            'Platba probíhá po ošetření – hotově nebo pomocí QR platby.',
        },
        {
          question: 'Je možné koupit dárkový voucher?',
          answer:
            'Ano, dárkový voucher je možné vystavit na konkrétní službu nebo podle individuální domluvy. Nejrychlejší je napsat do studia a společně doladíme hodnotu i způsob předání.',
          linkLabel: 'Napsat do studia',
          linkHref: '/kontakt',
        },
      ],
    },
    {
      id: 'storno',
      title: 'Storno',
      description: 'Jasné a stručné shrnutí pro případ, že potřebujete termín změnit nebo zrušit.',
      items: [
        {
          question: 'Jak je to se storno podmínkami?',
          answer: `Pokud by se vám termín nehodil, můžete ho upravit nebo zrušit nejpozději ${cancellationHours} hodin předem.`,
          linkLabel: 'Zobrazit storno podmínky',
          linkHref: '/storno-podminky',
        },
      ],
    },
  ];
}

export const faqSections = buildFaqSections(48);

export function buildCancellationPageContent(input: {
  cancellationHours: number;
  phone: string;
  email: string;
}): CancellationPageContent {
  return {
    title: 'Storno podmínky',
    intro: 'Zde najdete podmínky pro změnu a zrušení rezervace v PP Studiu.',
    ctaPrompt: 'Potřebujete změnit termín?',
    contactCardTitle: 'Jak zrušit rezervaci',
    contactCardDescription: 'Rezervaci můžete zrušit telefonicky, e-mailem nebo přes odkaz v potvrzení rezervace a reminderu.',
    contactCardNote: 'Jakmile víte, že termín nevyužijete, dejte nám vědět co nejdříve. Uvolněný čas můžeme nabídnout další klientce.',
    contactItems: [
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
    ],
    summaryTitle: 'Nejdůležitější pravidla',
    summaryCards: [
      {
        title: 'Včasné zrušení',
        value: `Více než ${input.cancellationHours} h předem`,
        description: 'Zrušení nebo změna termínu je bez poplatku.',
      },
      {
        title: 'Pozdní storno',
        value: `Méně než ${input.cancellationHours} h předem`,
        description: 'Prosíme o co nejrychlejší informaci. Pozdní zrušení komplikuje obsazení uvolněného času.',
      },
      {
        title: 'Nedostavení se',
        value: 'Bez omluvy',
        description: 'Pokud se situace opakuje, může být další rezervace potvrzena až po předchozí domluvě.',
      },
    ],
    sections: [
      {
        id: 'jak-zrusit-nebo-zmenit-rezervaci',
        eyebrow: '1. Co udělat',
        title: 'Jak zrušit nebo změnit rezervaci',
        paragraphs: [
          'Pro změnu nebo zrušení termínu nás můžete kontaktovat telefonicky nebo e-mailem. Rezervaci lze zrušit také přes odkaz, který posíláme v potvrzení rezervace a v reminderu před termínem.',
        ],
        items: [
          `telefon: ${input.phone}`,
          `e-mail: ${input.email}`,
          'odkaz pro zrušení nebo úpravu najdete také v potvrzení rezervace a v reminderu',
          'čím dříve se ozvete, tím snáz nabídneme náhradní termín nebo uvolníme místo další klientce',
        ],
      },
      {
        id: 'zruseni-a-zmena-terminu',
        eyebrow: '2. Termín',
        title: 'Zrušení a změna termínu',
        paragraphs: [
          `Při zrušení nebo přesunu více než ${input.cancellationHours} hodin před začátkem termínu je změna bez omezení.`,
          `Pokud potřebujete termín zrušit méně než ${input.cancellationHours} hodin předem, dejte nám prosím vědět co nejdříve. Storno poplatek nyní neúčtujeme, ale pozdní změna nám obvykle už neumožní nabídnout termín další klientce.`,
        ],
        note: 'Vyhrazený čas držíme pouze pro vaši návštěvu. Pozdní zrušení už obvykle nedokážeme obsadit jinou rezervací.',
      },
      {
        id: 'nedostaveni-se',
        eyebrow: '3. No-show',
        title: 'Nedostavení se bez omluvy',
        paragraphs: [
          'Pokud na potvrzený termín nepřijdete a nedáte nám předem vědět, bereme to jako nevyužitý rezervovaný čas.',
          'Při opakovaném nedostavení bez omluvy může být další rezervace potvrzena až po předchozí domluvě nebo se zálohou.',
        ],
      },
      {
        id: 'zpozdeni',
        eyebrow: '4. Dochvilnost',
        title: 'Zpoždění',
        paragraphs: [
          'Při pozdním příchodu službu zkrátíme tak, aby nebyl narušen další provoz studia.',
          'Cena služby zůstává stejná i v případě, že kvůli zpoždění nebude možné provést péči v plném rozsahu.',
        ],
      },
      {
        id: 'zalohy',
        eyebrow: '5. Záloha',
        title: 'Zálohy',
        paragraphs: [
          'U delších, blokovaných nebo opakovaně přesouvaných termínů může být předem domluvena záloha na rezervaci.',
          'Pokud by byla u konkrétní služby nebo termínu záloha požadována, vždy to klientce řekneme předem při potvrzení rezervace.',
        ],
      },
      {
        id: 'zruseni-ze-strany-salonu',
        eyebrow: '6. Provoz studia',
        title: 'Zrušení ze strany salonu',
        paragraphs: [
          'Pokud musíme termín zrušit z důvodu nemoci, provozní kolize nebo technického problému, ozveme se vám co nejdříve.',
          'V takové situaci vždy nabídneme náhradní termín nebo jiný nejbližší možný postup podle aktuální kapacity.',
        ],
      },
    ],
    footerNote: 'Pokud víte, že termín nestihnete, nečekejte prosím na poslední chvíli. Krátká zpráva nebo rychlý telefonát pomůže nám i dalším klientkám.',
  };
}

export function buildLegalContent(cancellationHours: number) {
  return {
    cancellation: {
      title: 'Storno podmínky',
      intro: 'Zde najdete podmínky pro změnu a zrušení rezervace v PP Studiu.',
      sections: [
        {
          id: 'zruseni-a-zmena-terminu',
          eyebrow: 'Změna rezervace',
          title: 'Zrušení a změna termínu',
          paragraphs: [
            `Rezervaci je možné zrušit nebo přesunout více než ${cancellationHours} hodin před začátkem termínu bez omezení.`,
            `Pokud klientka ruší termín méně než ${cancellationHours} hodin předem, studio žádá o co nejrychlejší informaci. Storno poplatek se v tuto chvíli automaticky neuplatňuje.`,
          ],
          note: 'Pro změnu nebo zrušení termínu lze využít kontakt na studio i odkaz zaslaný v potvrzení rezervace nebo v reminderu.',
        },
        {
          id: 'nedostaveni-se',
          eyebrow: 'No-show',
          title: 'Nedostavení se',
          paragraphs: [
            'Pokud se klientka na potvrzený termín bez omluvy nedostaví, vzniká studiu nevyužitý rezervovaný čas.',
            'Při opakovaném nedostavení může studio další rezervaci potvrdit až po předchozí domluvě nebo po vyžádání zálohy.',
          ],
        },
      ],
    },
    terms: {
      title: 'Obchodní podmínky',
      intro:
        'Tyto obchodní podmínky upravují rezervaci a poskytování služeb v PP Studiu. Najdete zde informace o objednání, storno podmínkách a průběhu služeb.',
      sections: [
        {
          id: 'poskytovatel-sluzeb',
          eyebrow: '1. Poskytovatel služeb',
          title: 'Identifikace studia a kontaktní údaje',
          paragraphs: [
            'Tyto obchodní podmínky upravují poskytování kosmetických a souvisejících služeb ve studiu PP Studio. Smluvní vztah vzniká mezi klientkou a provozovatelkou studia při potvrzení rezervace.',
            'Kontaktní údaje studia jsou uvedené v horním informačním bloku této stránky a na stránce Kontakt. Studio komunikuje především e-mailem a telefonicky.',
          ],
        },
        {
          id: 'objednani-sluzeb',
          eyebrow: '2. Objednání služeb',
          title: 'Jak vzniká rezervace',
          paragraphs: [
            'Službu je možné objednat online přes webový rezervační formulář, telefonicky nebo osobně podle aktuální dostupnosti termínů.',
            'Rezervace je platná okamžikem, kdy studio zvolený termín potvrdí. Potvrzená rezervace je závazná pro obě strany.',
          ],
          items: [
            'při online objednání klientka vyplní nezbytné kontaktní údaje',
            'při telefonické nebo osobní domluvě může studio potvrzení zaslat následně e-mailem nebo zprávou',
            'klientka odpovídá za správnost uvedeného telefonu a e-mailu',
          ],
        },
        {
          id: 'zmena-a-zruseni-rezervace',
          eyebrow: '3. Změna a zrušení rezervace',
          title: 'Storno a přesun termínu',
          paragraphs: [
            `Rezervaci je možné zrušit nebo přesunout nejpozději ${cancellationHours} hodin před začátkem termínu. Nejrychlejší je využít kontaktní údaje studia nebo storno odkaz, pokud byl u rezervace zaslán.`,
            `Při zrušení méně než ${cancellationHours} hodin předem, při opakovaném pozdním rušení nebo při nedostavení se bez omluvy může studio požadovat zálohu na další rezervaci nebo další termín nepotvrdit.`,
          ],
          note:
            'Pokud se dostanete do nenadálé situace, ozvěte se co nejdříve. Cílem je najít férové řešení a zároveň chránit vyhrazený čas studia.',
        },
        {
          id: 'cena-a-platba',
          eyebrow: '4. Cena a platba',
          title: 'Aktuální ceny a úhrada služeb',
          paragraphs: [
            'Ceny služeb se řídí aktuálním ceníkem zveřejněným na webu nebo sděleným při objednání. U časově náročnějších nebo individuálně upravených služeb může být cena upřesněna před zahájením ošetření.',
            'Úhrada probíhá po poskytnutí služby způsobem, který studio v danou chvíli umožňuje. Pokud je u konkrétní rezervace požadována záloha, klientka o tom bude informována předem.',
          ],
          items: [
            'ceny mohou být průběžně upravovány bez zpětného dopadu na již potvrzené termíny',
            'akční nebo zvýhodněné nabídky nelze zpětně kombinovat, pokud není výslovně uvedeno jinak',
          ],
        },
        {
          id: 'prubeh-sluzby',
          eyebrow: '5. Průběh služby',
          title: 'Dochvilnost a provozní pravidla',
          paragraphs: [
            'Klientka je povinna dostavit se na sjednaný termín včas. Pozdní příchod může vést ke zkrácení služby, aby nebyl narušen navazující provoz studia.',
            'Studio si vyhrazuje právo službu neposkytnout nebo ji upravit, pokud by její bezpečné provedení neodpovídalo aktuálnímu stavu klientky, hygienickým pravidlům nebo rozsahu rezervovaného času.',
          ],
          items: [
            'na termín doporučujeme přijít bez zbytečného předstihu i bez výrazného zpoždění',
            'doprovod je vhodné konzultovat předem, zejména u delších nebo klidových procedur',
            'během návštěvy je potřeba respektovat hygienická a provozní pravidla studia',
          ],
        },
        {
          id: 'zdravotni-stav-a-odpovednost',
          eyebrow: '6. Zdravotní stav a odpovědnost',
          title: 'Informace důležité pro bezpečné ošetření',
          paragraphs: [
            'Klientka je povinna před zahájením služby pravdivě informovat studio o zdravotních omezeních, alergiích, kožních problémech, těhotenství nebo jiných skutečnostech, které mohou mít vliv na průběh ošetření.',
            'Studio nenese odpovědnost za komplikace nebo nespokojenost se službou, pokud klientka podstatné informace zamlčela nebo nedodržela následná doporučení po ošetření.',
          ],
          note:
            'Pokud si nejste jistá vhodností služby, doporučujeme se ozvat ještě před rezervací. Krátká konzultace často předejde zbytečnému zklamání i zdravotnímu riziku.',
        },
        {
          id: 'reklamace',
          eyebrow: '7. Reklamace',
          title: 'Jak řešit nespokojenost nebo výhrady',
          paragraphs: [
            'Pokud nejste s průběhem nebo výsledkem služby spokojená, kontaktujte studio bez zbytečného odkladu. Reklamace se řeší individuálně s ohledem na charakter služby a okolnosti konkrétní návštěvy.',
            'Studio se zavazuje reklamaci posoudit v přiměřené lhůtě a navrhnout další postup, například kontrolní návštěvu, úpravu výsledku nebo jiné férové řešení podle povahy situace.',
          ],
          items: [
            'pro rychlé vyřízení doporučujeme připojit popis problému a případně aktuální fotografii',
            'reklamaci je vhodné uplatnit e-mailem nebo telefonicky přes kontakty uvedené na této stránce',
          ],
        },
        {
          id: 'darkove-poukazy',
          eyebrow: '8. Dárkové poukazy',
          title: 'Podmínky použití poukazů',
          paragraphs: [
            'Pokud studio vydá dárkový poukaz, lze jej využít pouze v době jeho platnosti a za podmínek uvedených na poukazu nebo při jeho vystavení.',
            'Dárkový poukaz nelze směnit za hotovost. Pokud není dohodnuto jinak, nevyčerpaná hodnota se neproplácí a po uplynutí platnosti poukaz bez náhrady zaniká.',
          ],
        },
        {
          id: 'zaverecna-ustanoveni',
          eyebrow: '9. Závěrečná ustanovení',
          title: 'Platnost a změny podmínek',
          paragraphs: [
            'Tyto obchodní podmínky nabývají účinnosti dne 23. 4. 2026. Studio si vyhrazuje právo je přiměřeně aktualizovat, pokud se změní provozní nastavení, rezervační proces nebo zákonné požadavky.',
            'Pro konkrétní rezervaci vždy platí znění obchodních podmínek účinné v den potvrzení daného termínu, pokud se studio s klientkou výslovně nedohodne jinak.',
          ],
        },
      ],
    },
    gdpr: {
    title: 'GDPR a ochrana osobních údajů',
    intro:
      'Osobní údaje zpracováváme jen v rozsahu, který je potřeba pro rezervaci termínu, běžnou komunikaci s klientkou a splnění zákonných povinností. Níže najdete přehled, jak s údaji v PP Studiu pracujeme.',
    sections: [
      {
        id: 'spravce',
        title: 'Správce osobních údajů',
        paragraphs: [
          'Správcem osobních údajů je PP Studio. To znamená, že určujeme, za jakým účelem a jakým způsobem jsou osobní údaje při provozu studia používány.',
          'Pokud budete potřebovat cokoliv vysvětlit nebo si uplatnit některé ze svých práv, můžete nás kontaktovat prostřednictvím uvedených kontaktních údajů.',
        ],
      },
      {
        id: 'jake-udaje',
        title: 'Jaké údaje zpracováváme',
        paragraphs: [
          'Rozsah zpracovávaných údajů se odvíjí od toho, jakou službu využíváte a jak spolu komunikujeme. Vždy se snažíme pracovat jen s tím, co je pro provoz studia skutečně potřebné.',
        ],
        items: [
          'jméno a příjmení',
          'telefonní číslo',
          'e-mailová adresa',
          'údaje spojené s rezervací termínu a vybranou službou',
          'provozní poznámky, pokud jsou nezbytné pro bezpečné a správné poskytnutí služby',
        ],
      },
      {
        id: 'ucely',
        title: 'Pro jaké účely údaje používáme',
        paragraphs: [
          'Osobní údaje nepoužíváme bezdůvodně. Každé zpracování má svůj praktický a zákonný důvod.',
        ],
        items: [
          'vyřízení rezervace a potvrzení domluveného termínu',
          'komunikace před návštěvou i po ní, pokud je to potřeba',
          'vedení základní provozní evidence a návazné administrativy',
          'plnění zákonných povinností, zejména v oblasti účetnictví a daňových dokladů',
        ],
      },
      {
        id: 'uchovani',
        title: 'Jak dlouho údaje uchováváme',
        paragraphs: [
          'Údaje neuchováváme déle, než je potřeba. Konkrétní doba se liší podle typu záznamu a důvodu, proč byl vytvořen.',
        ],
        items: [
          'rezervace a související provozní údaje po dobu nezbytnou pro organizaci termínu, řešení změn a běžnou návaznou evidenci',
          'běžnou e-mailovou nebo telefonickou komunikaci po dobu potřebnou k dořešení dotazu nebo rezervace',
          'účetní a daňové doklady po dobu stanovenou právními předpisy',
          'marketingovou komunikaci pouze pokud by byla vedena na základě souhlasu, a to po dobu jeho trvání nebo do odvolání',
        ],
        note:
          'Pokud některé údaje musíme uchovat déle kvůli právní povinnosti nebo ochraně oprávněných zájmů, děje se tak jen v nezbytném rozsahu.',
      },
      {
        id: 'zpristupneni',
        title: 'Komu mohou být údaje zpřístupněny',
        paragraphs: [
          'K osobním údajům mají přístup jen osoby a služby, které je potřebují pro zajištění chodu studia. Vždy jen v nezbytném rozsahu.',
        ],
        items: [
          'poskytovatel webu a hostingu',
          'poskytovatel e-mailových a komunikačních služeb',
          'účetní nebo daňový poradce, pokud je to nutné pro splnění zákonných povinností',
          'orgány veřejné moci, pokud to ukládá právní předpis',
        ],
      },
      {
        id: 'prava',
        title: 'Jaká máte práva',
        paragraphs: [
          'Ve vztahu ke svým osobním údajům máte práva, která můžete kdykoli uplatnit. Na váš dotaz nebo žádost odpovíme bez zbytečného odkladu.',
        ],
        items: [
          'právo na přístup k osobním údajům',
          'právo na opravu nepřesných nebo neaktuálních údajů',
          'právo na výmaz, pokud už údaje nejsou potřebné nebo pro jejich zpracování není důvod',
          'právo na omezení zpracování v případech stanovených právními předpisy',
          'právo vznést námitku proti zpracování, pokud je založené na oprávněném zájmu',
          'právo podat stížnost u Úřadu pro ochranu osobních údajů',
        ],
      },
      {
        id: 'kontakt',
        title: 'Jak nás kontaktovat',
        paragraphs: [
          'Pokud máte otázku ke zpracování osobních údajů nebo chcete uplatnit některé ze svých práv, napište nám e-mail nebo zavolejte. Nejrychlejší je ozvat se přes kontaktní údaje uvedené výše na této stránce.',
        ],
        note:
          'Uděláme maximum pro to, aby komunikace byla srozumitelná, věcná a bez zbytečně složitých formalit.',
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
