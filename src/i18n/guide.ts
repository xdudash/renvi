// Guide for men: "Знакомься уверенно". Long-form copy lives here (not in the key/value dictionaries) because it is
// structured: chapters with a lead and tips. Missing languages fall back to Russian, like translate().
import type { LangCode } from './index.ts';

export type GuideChapter = { title: string; lead: string; tips: string[] };

const RU: GuideChapter[] = [
  {
    title: 'Анкета, которую хочется открыть',
    lead: 'Первое впечатление складывается за пару секунд. Задача анкеты — показать тебя настоящего и дать повод написать.',
    tips: [
      'Первое фото — лицо крупно, дневной свет, без очков и кепки. Улыбка работает лучше «серьёзного взгляда».',
      'Добавь фото в деле: спорт, путешествие, хобби. Одно фото в полный рост. Без фото из машины и с рыбой.',
      'Никаких групповых снимков первыми: человек не должен угадывать, кто из пятерых ты.',
      'В ответах на вопросы будь конкретным: не «люблю путешествовать», а «в прошлом году прошёл Татры с палаткой».',
    ],
  },
  {
    title: 'Первое сообщение',
    lead: '«Привет, как дела?» получают все. Выделяется тот, кто показывает, что посмотрел анкету.',
    tips: [
      'Отвечай на конкретное фото или ответ в анкете — для этого в RENVI есть кнопка «С сообщением».',
      'Задай открытый вопрос: «Как ты нашла эту кофейню у реки?» вместо «Любишь кофе?».',
      'Коротко и легко: одно-два предложения. Длинное эссе в первом сообщении давит.',
      'Без комплиментов внешности в первой фразе — лучше заметь вкус, юмор или интересную деталь.',
    ],
  },
  {
    title: 'О чём говорить',
    lead: 'Хороший разговор — это обмен историями, а не допрос. Спрашивай и делись сам.',
    tips: [
      'Темы, которые почти всегда заходят: поездки, еда и любимые места в городе, планы на выходные, смешные случаи.',
      'Спрашивай «почему» и «как»: «Почему именно архитектура?» открывает больше, чем «Где работаешь?».',
      'Делись своим в ответ: на её историю — твоя похожая. Так появляется ощущение «у нас много общего».',
      'Отложи до встречи тяжёлые темы: бывшие, политика, деньги, жалобы на жизнь.',
    ],
  },
  {
    title: 'Как вести диалог',
    lead: 'Уверенность в переписке — это спокойствие и инициатива, а не напор.',
    tips: [
      'Не отвечай мгновенно ночью и не засыпай сообщениями, если ответа нет — у людей своя жизнь.',
      'Подхватывай детали: она упомянула экзамен — через пару дней спроси, как всё прошло.',
      'Юмор лёгкий и без подколок над ней. Самоирония работает отлично.',
      'Если разговор угас, не обижайся. Одно лёгкое сообщение позже — нормально, три подряд — нет.',
    ],
  },
  {
    title: 'Переход к встрече',
    lead: 'Переписка ради переписки быстро надоедает. Через 2–4 дня хорошего общения предлагай увидеться.',
    tips: [
      'Предлагай конкретно: «Давай в субботу днём пройдёмся по набережной и выпьем кофе?»',
      'Первая встреча — короткая, днём, в людном месте. Это комфортно для вас обоих.',
      'Используй кнопку «Предложить встречу» в чате: место и время сразу видны, ответить легко.',
      'Если «нет» или «пока не готова» — спокойно прими. Давление убивает интерес.',
    ],
  },
  {
    title: 'Уважение и границы',
    lead: 'Самое привлекательное качество — когда с тобой безопасно и спокойно.',
    tips: [
      '«Нет» — это ответ, а не начало уговоров. Это касается и встречи, и номера телефона, и фото.',
      'Никаких откровенных сообщений и фото без явного взаимного желания — это нарушение правил RENVI.',
      'Будь честным в анкете: рост, возраст, цели. Правда всё равно выяснится на встрече.',
      'Если не хочешь продолжать — скажи об этом прямо и вежливо, а не исчезай молча.',
    ],
  },
];

const EN: GuideChapter[] = [
  {
    title: 'A profile people want to open',
    lead: 'First impressions take a couple of seconds. Your profile should show the real you and give a reason to write.',
    tips: [
      'First photo: your face, close up, daylight, no sunglasses or cap. A smile beats a "serious look".',
      'Add photos of you doing things: sport, travel, hobbies. One full-length photo. Skip car selfies.',
      'Never a group photo first: nobody should have to guess which of the five is you.',
      'Be specific in your answers: not "I love travelling" but "last year I hiked the Tatras with a tent".',
    ],
  },
  {
    title: 'The first message',
    lead: 'Everyone gets "Hi, how are you?". You stand out by showing you actually read the profile.',
    tips: [
      'Reply to a specific photo or answer — that is what the "With a message" button in RENVI is for.',
      'Ask an open question: "How did you find that café by the river?" instead of "Do you like coffee?".',
      'Keep it short and light: one or two sentences. A long essay as a first message feels heavy.',
      'Skip compliments on looks in the first line — notice her taste, humour or an interesting detail instead.',
    ],
  },
  {
    title: 'What to talk about',
    lead: 'A good conversation is swapping stories, not an interview. Ask, and share yourself.',
    tips: [
      'Topics that almost always work: trips, food and favourite places in town, weekend plans, funny moments.',
      'Ask "why" and "how": "Why architecture?" opens up more than "Where do you work?".',
      'Share back: her story, then a similar one of yours. That is how "we have a lot in common" feels.',
      'Save heavy topics for later: exes, politics, money, complaints about life.',
    ],
  },
  {
    title: 'Keeping the conversation going',
    lead: 'Confidence in chat means calm and initiative, not pressure.',
    tips: [
      'No instant replies at 3 a.m., and no message floods when she has not answered — people have lives.',
      'Pick up details: she mentioned an exam — a few days later, ask how it went.',
      'Keep humour light and never at her expense. Self-irony works great.',
      'If the chat fades, do not take offence. One light message later is fine, three in a row is not.',
    ],
  },
  {
    title: 'Moving to a date',
    lead: 'Chatting for the sake of chatting gets old. After 2–4 days of good conversation, suggest meeting.',
    tips: [
      'Be specific: "Saturday afternoon, a walk by the river and a coffee?"',
      'Keep the first date short, in daylight, in a public place. Comfortable for both of you.',
      'Use "Suggest a date" in the chat: place and time are clear and easy to answer.',
      'If it is "no" or "not yet", accept it calmly. Pressure kills interest.',
    ],
  },
  {
    title: 'Respect and boundaries',
    lead: 'The most attractive quality: being someone it feels safe and easy to be around.',
    tips: [
      '"No" is an answer, not the start of persuasion — for dates, phone numbers and photos alike.',
      'No explicit messages or photos without clear mutual wish — that breaks RENVI rules.',
      'Be honest in your profile: height, age, intentions. The truth shows up on the date anyway.',
      'If you do not want to continue, say so directly and politely instead of vanishing.',
    ],
  },
];

const SK: GuideChapter[] = [
  {
    title: 'Profil, ktorý chce každý otvoriť',
    lead: 'Prvý dojem vznikne za pár sekúnd. Profil má ukázať skutočného teba a dať dôvod napísať.',
    tips: [
      'Prvá fotka: tvoja tvár zblízka, denné svetlo, bez slnečných okuliarov a šiltovky. Úsmev funguje lepšie.',
      'Pridaj fotky v akcii: šport, cestovanie, záľuby. Jednu fotku celej postavy. Bez selfie z auta.',
      'Nikdy nie skupinovú fotku ako prvú: nikto nemá hádať, ktorý z piatich si ty.',
      'V odpovediach buď konkrétny: nie „rád cestujem“, ale „minulý rok som prešiel Tatry so stanom“.',
    ],
  },
  {
    title: 'Prvá správa',
    lead: '„Ahoj, ako sa máš?“ dostáva každý. Vynikneš, keď ukážeš, že si profil naozaj čítal.',
    tips: [
      'Reaguj na konkrétnu fotku alebo odpoveď — na to je v RENVI tlačidlo „So správou“.',
      'Polož otvorenú otázku: „Ako si našla tú kaviareň pri rieke?“ namiesto „Máš rada kávu?“.',
      'Krátko a ľahko: jedna-dve vety. Dlhá esej v prvej správe pôsobí ťažko.',
      'Bez komplimentov na vzhľad v prvej vete — radšej si všimni vkus, humor alebo zaujímavý detail.',
    ],
  },
  {
    title: 'O čom sa rozprávať',
    lead: 'Dobrý rozhovor je výmena príbehov, nie výsluch. Pýtaj sa a hovor aj o sebe.',
    tips: [
      'Témy, ktoré takmer vždy fungujú: cesty, jedlo a obľúbené miesta v meste, plány na víkend, vtipné zážitky.',
      'Pýtaj sa „prečo“ a „ako“: „Prečo práve architektúra?“ otvorí viac než „Kde pracuješ?“.',
      'Odpovedz vlastným: na jej príbeh tvoj podobný. Tak vzniká pocit „máme veľa spoločné“.',
      'Ťažké témy nechaj na neskôr: bývalí, politika, peniaze, sťažnosti na život.',
    ],
  },
  {
    title: 'Ako viesť rozhovor',
    lead: 'Sebavedomie v chate je pokoj a iniciatíva, nie nátlak.',
    tips: [
      'Neodpovedaj okamžite o tretej v noci a nezasypávaj ju správami, keď neodpovedá.',
      'Zachyť detaily: spomenula skúšku — o pár dní sa spýtaj, ako dopadla.',
      'Humor ľahký a nikdy na jej účet. Sebairónia funguje skvele.',
      'Keď rozhovor utíchne, neurážaj sa. Jedna ľahká správa neskôr je v poriadku, tri za sebou nie.',
    ],
  },
  {
    title: 'Prechod k stretnutiu',
    lead: 'Písanie len pre písanie rýchlo omrzí. Po 2–4 dňoch dobrého rozhovoru navrhni stretnutie.',
    tips: [
      'Navrhni konkrétne: „V sobotu poobede prechádzka pri Dunaji a káva?“',
      'Prvé stretnutie krátke, cez deň, na verejnom mieste. Pohodlné pre oboch.',
      'Použi v chate „Navrhnúť stretnutie“: miesto aj čas sú hneď jasné.',
      'Ak povie „nie“ alebo „ešte nie“, prijmi to pokojne. Nátlak zabíja záujem.',
    ],
  },
  {
    title: 'Rešpekt a hranice',
    lead: 'Najpríťažlivejšia vlastnosť: pri tebe sa človek cíti bezpečne a pokojne.',
    tips: [
      '„Nie“ je odpoveď, nie začiatok presviedčania — pri stretnutí, čísle aj fotkách.',
      'Žiadne explicitné správy či fotky bez jasného vzájomného záujmu — porušuje to pravidlá RENVI.',
      'Buď v profile úprimný: výška, vek, zámery. Pravda aj tak vyjde najavo.',
      'Ak nechceš pokračovať, povedz to priamo a slušne namiesto mlčky zmiznúť.',
    ],
  },
];

const CS: GuideChapter[] = [
  {
    title: 'Profil, který chce každý otevřít',
    lead: 'První dojem vznikne za pár vteřin. Profil má ukázat skutečného tebe a dát důvod napsat.',
    tips: [
      'První fotka: tvůj obličej zblízka, denní světlo, bez slunečních brýlí a kšiltovky. Úsměv funguje líp.',
      'Přidej fotky v akci: sport, cestování, koníčky. Jednu fotku celé postavy. Bez selfie z auta.',
      'Nikdy ne skupinovou fotku jako první: nikdo nemá hádat, který z pěti jsi ty.',
      'V odpovědích buď konkrétní: ne „rád cestuju“, ale „loni jsem prošel Tatry se stanem“.',
    ],
  },
  {
    title: 'První zpráva',
    lead: '„Ahoj, jak se máš?“ dostává každý. Vynikneš, když ukážeš, že jsi profil opravdu četl.',
    tips: [
      'Reaguj na konkrétní fotku nebo odpověď — k tomu je v RENVI tlačítko „Se zprávou“.',
      'Polož otevřenou otázku: „Jak jsi našla tu kavárnu u řeky?“ místo „Máš ráda kávu?“.',
      'Krátce a lehce: jedna dvě věty. Dlouhá esej v první zprávě působí těžce.',
      'Bez komplimentů na vzhled v první větě — raději si všimni vkusu, humoru nebo zajímavého detailu.',
    ],
  },
  {
    title: 'O čem mluvit',
    lead: 'Dobrý rozhovor je výměna příběhů, ne výslech. Ptej se a mluv i o sobě.',
    tips: [
      'Témata, která skoro vždy fungují: cesty, jídlo a oblíbená místa ve městě, plány na víkend, vtipné zážitky.',
      'Ptej se „proč“ a „jak“: „Proč zrovna architektura?“ otevře víc než „Kde pracuješ?“.',
      'Odpověz vlastním: na její příběh tvůj podobný. Tak vzniká pocit „máme hodně společného“.',
      'Těžká témata nech na později: bývalí, politika, peníze, stížnosti na život.',
    ],
  },
  {
    title: 'Jak vést rozhovor',
    lead: 'Sebevědomí v chatu je klid a iniciativa, ne nátlak.',
    tips: [
      'Neodpovídej okamžitě ve tři ráno a nezahlcuj ji zprávami, když neodpovídá.',
      'Zachyť detaily: zmínila zkoušku — za pár dní se zeptej, jak dopadla.',
      'Humor lehký a nikdy na její účet. Sebeironie funguje skvěle.',
      'Když rozhovor utichne, neurážej se. Jedna lehká zpráva později je v pořádku, tři za sebou ne.',
    ],
  },
  {
    title: 'Přechod ke schůzce',
    lead: 'Psaní jen pro psaní rychle omrzí. Po 2–4 dnech dobrého rozhovoru navrhni schůzku.',
    tips: [
      'Navrhni konkrétně: „V sobotu odpoledne procházka u řeky a káva?“',
      'První schůzka krátká, přes den, na veřejném místě. Pohodlné pro oba.',
      'Použij v chatu „Navrhnout schůzku“: místo i čas jsou hned jasné.',
      'Když řekne „ne“ nebo „ještě ne“, přijmi to klidně. Nátlak zabíjí zájem.',
    ],
  },
  {
    title: 'Respekt a hranice',
    lead: 'Nejpřitažlivější vlastnost: u tebe se člověk cítí bezpečně a klidně.',
    tips: [
      '„Ne“ je odpověď, ne začátek přemlouvání — u schůzky, čísla i fotek.',
      'Žádné explicitní zprávy či fotky bez jasného vzájemného zájmu — porušuje to pravidla RENVI.',
      'Buď v profilu upřímný: výška, věk, záměry. Pravda stejně vyjde najevo.',
      'Když nechceš pokračovat, řekni to přímo a slušně místo mlčky zmizet.',
    ],
  },
];

const UA: GuideChapter[] = [
  {
    title: 'Анкета, яку хочеться відкрити',
    lead: 'Перше враження складається за кілька секунд. Анкета має показати тебе справжнього й дати привід написати.',
    tips: [
      'Перше фото — обличчя крупно, денне світло, без окулярів і кепки. Усмішка працює краще за «серйозний погляд».',
      'Додай фото в дії: спорт, подорожі, хобі. Одне фото на повний зріст. Без селфі з авто.',
      'Ніяких групових знімків першими: людина не має вгадувати, хто з п’ятьох ти.',
      'У відповідях будь конкретним: не «люблю подорожувати», а «торік пройшов Татри з наметом».',
    ],
  },
  {
    title: 'Перше повідомлення',
    lead: '«Привіт, як справи?» отримують усі. Виділяється той, хто показує, що подивився анкету.',
    tips: [
      'Відповідай на конкретне фото чи відповідь в анкеті — для цього в RENVI є кнопка «З повідомленням».',
      'Став відкрите питання: «Як ти знайшла цю кав’ярню біля річки?» замість «Любиш каву?».',
      'Коротко й легко: одне-два речення. Довге есе в першому повідомленні тисне.',
      'Без компліментів зовнішності в першій фразі — краще поміть смак, гумор чи цікаву деталь.',
    ],
  },
  {
    title: 'Про що говорити',
    lead: 'Хороша розмова — це обмін історіями, а не допит. Питай і ділися сам.',
    tips: [
      'Теми, які майже завжди заходять: подорожі, їжа й улюблені місця в місті, плани на вихідні, смішні випадки.',
      'Питай «чому» і «як»: «Чому саме архітектура?» відкриває більше, ніж «Де працюєш?».',
      'Ділися своїм у відповідь: на її історію — твоя схожа. Так з’являється відчуття «у нас багато спільного».',
      'Важкі теми — на потім: колишні, політика, гроші, скарги на життя.',
    ],
  },
  {
    title: 'Як вести діалог',
    lead: 'Впевненість у листуванні — це спокій та ініціатива, а не натиск.',
    tips: [
      'Не відповідай миттєво о третій ночі й не засипай повідомленнями, якщо відповіді немає.',
      'Підхоплюй деталі: вона згадала іспит — за кілька днів спитай, як усе пройшло.',
      'Гумор легкий і без підколок над нею. Самоіронія працює чудово.',
      'Якщо розмова згасла, не ображайся. Одне легке повідомлення пізніше — нормально, три поспіль — ні.',
    ],
  },
  {
    title: 'Перехід до зустрічі',
    lead: 'Листування заради листування швидко набридає. Після 2–4 днів хорошого спілкування пропонуй зустрітися.',
    tips: [
      'Пропонуй конкретно: «Давай у суботу вдень прогуляємося набережною і вип’ємо кави?»',
      'Перша зустріч — коротка, вдень, у людному місці. Це комфортно для вас обох.',
      'Використовуй кнопку «Запропонувати зустріч» у чаті: місце й час одразу видно.',
      'Якщо «ні» чи «поки не готова» — спокійно прийми. Тиск вбиває інтерес.',
    ],
  },
  {
    title: 'Повага і межі',
    lead: 'Найпривабливіша якість — коли з тобою безпечно і спокійно.',
    tips: [
      '«Ні» — це відповідь, а не початок умовлянь. Це стосується і зустрічі, і номера, і фото.',
      'Жодних відвертих повідомлень і фото без явного взаємного бажання — це порушення правил RENVI.',
      'Будь чесним в анкеті: зріст, вік, цілі. Правда все одно з’ясується на зустрічі.',
      'Якщо не хочеш продовжувати — скажи про це прямо й ввічливо, а не зникай мовчки.',
    ],
  },
];

const GUIDE: Partial<Record<LangCode, GuideChapter[]>> = { RU, EN, SK, CS, UA };

export function guideChapters(lang: LangCode): GuideChapter[] {
  return GUIDE[lang] ?? RU;
}
