/* ============================================================================
   КООПЕРАТИВ — ДАННЫЕ
   Единственный источник правды по ресурсам: прайс-лист
   «Прайс-лист на хлам и ресурсы (в гайках)».

   Структура реестра:
     id        — имя файла иконки в assets/ittems/textures/item/<id>.png
     name      — название как в прайсе
     price     — цена за 1 шт. в гайках (число, для расчётов)
     priceLabel— как показывать цену, если в прайсе диапазон («3–4»)
     tier      — редкость (раздел прайса)
     cat       — функциональный тип (фильтр «Тип»)
     note      — комментарий к цене (опт, уточнение)
     out       — true, если позиции нет в прайсе (унаследована из старых данных)
   ========================================================================== */

const CONFIG = {
  siteTitle: "Кооператив",
  storageKey: "koop_site_v7",
  legacyKeys: ["koop_editor_v6"],
  dataVersion: 7,
  editPassword: "9844",
  iconDir: "assets/ittems/textures/item/",
  sealPath: "assets/ittems/textures/svgs/pechat.svg",
  currency: "гайка"
};

/* ---------------------------------------------------------------------------
   РЕДКОСТИ (порядок разделов = порядок в прайсе)
   ------------------------------------------------------------------------- */
const TIERS = [
  { id: "junk",      name: "Хлам",             order: 1, color: "#8b96a3",
    hint: "Самый ходовой мусор: 1–10 гаек за штуку." },
  { id: "common",    name: "Распространённые", order: 2, color: "#6fb36b",
    hint: "Основная масса добычи с лута и разбора." },
  { id: "uncommon",  name: "Средне-редкие",    order: 3, color: "#4f9fd4",
    hint: "Оружейные и броневые заготовки среднего уровня." },
  { id: "rare",      name: "Редкие",           order: 4, color: "#9b6cd8",
    hint: "Ключевые детали оружия и брони." },
  { id: "legendary", name: "Крайне редкие",    order: 5, color: "#d4a017",
    hint: "Штучный товар, опт — отдельно." },
  { id: "vanilla",   name: "Ванилла",          order: 6, color: "#57a15d",
    hint: "Базовые руды и порох." },
  { id: "other",     name: "Без редкости",     order: 7, color: "#6f7681",
    hint: "Позиции прайса, для которых редкость не указана." }
];

/* ---------------------------------------------------------------------------
   ТИПЫ РЕСУРСОВ
   ------------------------------------------------------------------------- */
const CATS = {
  weapon:  "Оружие",
  ammo:    "Боеприпасы",
  electro: "Электроника",
  junk:    "Бытовой хлам",
  tools:   "Инструменты",
  auto:    "Автозапчасти",
  armor:   "Броня",
  vanilla: "Ванилла",
  tech:    "Техника"
};

/* ---------------------------------------------------------------------------
   РЕЕСТР
   ------------------------------------------------------------------------- */
const I = (id, name, price, tier, cat, extra) =>
  Object.assign({ id, name, price, tier, cat, priceLabel: null, note: null, out: false }, extra || {});

const CATALOG = [
  /* ======================= ХЛАМ ======================= */
  I("moneta_sssr",        "Стёртая монета",                  2,  "junk", "junk"),
  I("pulya_expansiv",     "Деформированная пуля",            2,  "junk", "ammo"),
  I("izolyat_keram",      "Керамический изолятор",           3,  "junk", "junk"),
  I("pulya_serdtsevin",   "Стальной сердечник пули",         4,  "junk", "ammo"),
  I("svinets_kartech",    "Картечь",                         5,  "junk", "ammo"),
  I("zamok_navesnoy",     "Замок",                           6,  "junk", "junk"),
  I("shnur_parakord",     "Моток паракорда",                 8,  "junk", "armor"),
  I("mednaya_obmotka",    "Медная обмотка",                  9,  "junk", "electro"),
  I("splav_svinets",      "Слиток грязного свинца",          10, "junk", "ammo"),
  I("plashka_pamyat",     "Планка ОЗУ",                      0,  "junk", "electro",
    { priceLabel: "—", note: "Цена в прайсе не указана" }),

  /* =================== РАСПРОСТРАНЁННЫЕ =================== */
  I("gazeta_soviet",      "Обрывок газеты",                  3,  "common", "junk"),
  I("korobka_patrony",    "Картонные пачки",                 3,  "common", "ammo"),
  I("rascheska_plast",    "Сломанная расчёска",              3,  "common", "junk"),
  I("shlak_metall",       "Металлический шлак",              5,  "common", "junk"),
  I("banka_konservy",     "Консервные банки",                1,  "common", "junk"),
  I("gvozd_gnuty",        "Гнутый гвоздь",                   1,  "common", "junk"),
  I("zerkalo_oskolok",    "Осколок зеркала",                 3,  "common", "junk"),
  I("ochi_broken",        "Треснувшие очки",                 1,  "common", "junk"),
  I("ampula_steklo",      "Пустая ампула",                   3,  "common", "junk"),
  I("tkanevaya_vetosh",   "Промасленная ветошь",             7,  "common", "junk"),
  I("klyuch_rzhavy",      "Ржавый ключ",                     2,  "common", "junk"),
  I("zhest_list",         "Листы жести",                     5,  "common", "junk"),
  I("pizh_voylok",        "Войлочный пыж",                   3,  "common", "ammo"),
  I("bolt_gaika",         "Набор гаек с болтами",            4,  "common", "junk",
    { priceLabel: "3–4" }),
  I("batareyka_kron",     "Севшая батарейка",                5,  "common", "electro"),
  I("akkum_vzdut",        "Раздутый аккумулятор",            6,  "common", "electro"),
  I("displej_nokia",      "Разбитый дисплей",                2,  "common", "electro"),
  I("zaklepka_stal",      "Стальная заклёпка",               4,  "common", "armor"),
  I("podshipnik_rzhavy",  "Ржавый подшипник",                3,  "common", "electro"),
  I("armatura_kusok",     "Арматура",                        15, "common", "junk"),
  I("britva_opas",        "Опасная бритва",                  2,  "common", "junk"),
  I("nitki_nylon",        "Нейлоновые нитки",                10, "common", "armor"),
  I("gilza_pistolet",     "Гильзы пистолетные",              2,  "common", "ammo"),
  I("gilza_vintovka",     "Гильзы винтовочные",              2,  "common", "ammo"),
  I("gilza_drobovik",     "Гильзы ружейные",                 2,  "common", "ammo"),
  I("gilza_sniper",       "Гильзы снайперские",              2,  "common", "ammo"),
  I("provodka_zhgut",     "Жгут проводов",                   2,  "common", "electro"),
  I("kondensator",        "Конденсатор",                     6,  "common", "electro"),
  I("diod_most",          "Диодный мост",                    7,  "common", "electro"),
  I("dinamik_maly",       "Маленький динамик",               4,  "common", "electro",
    { priceLabel: "3–4" }),
  I("izolenta_sinyaya",   "Моток изоленты",                  5,  "common", "junk"),
  I("drob_svinets",       "Мешочек с дробью",                3,  "common", "ammo"),
  I("kapsul_vosh",        "Капсюль",                         2,  "common", "ammo"),
  I("pulya_obolochka",    "Оболочечная пуля",                5,  "common", "ammo"),
  I("magazin_korpus",     "Корпус магазина",                 10, "common", "weapon"),
  I("magnit_ferrit",      "Ферритовый магнит",               1,  "common", "electro"),
  I("radiator_alyum",     "Радиатор алюминиевый",            12, "common", "electro"),
  I("radiolampa",         "Радиолампа",                      2,  "common", "electro"),
  I("provod_katushka",    "Катушка провода",                 3,  "common", "electro"),
  I("shesternya_stal",    "Стальная шестерня",               10, "common", "electro",
    { note: "Опт от 10 шт.: скидка 10–15%" }),
  I("priklad_derevo",     "Деревянный приклад",              15, "common", "weapon"),
  I("trubka_med",         "Медная трубка",                   10, "common", "electro"),
  I("plata_tv",           "Плата телевизора",                3,  "common", "electro"),
  I("poroh_banka",        "Банка с порохом",                 2,  "common", "ammo"),
  I("motorchik",          "Моторчик",                        15, "common", "electro"),
  I("plashka_mikro",      "Микросхема",                      4,  "common", "electro"),
  I("probka_rezina",      "Резиновая пробка",                3,  "common", "junk"),

  /* ==================== СРЕДНЕ-РЕДКИЕ ==================== */
  I("bint_gryazny",       "Использованный бинт",             6,  "uncommon", "junk"),
  I("tsep_metall",        "Обрывок цепи",                    1,  "uncommon", "junk"),
  I("lampa_nakal",        "Лампочки",                        9,  "uncommon", "electro"),
  I("ugol_aktiv",         "Уголь для пороховой смеси",       10, "uncommon", "ammo"),
  I("remen_stropa",       "Нейлоновая стропа",               25, "uncommon", "armor"),
  I("rele_povorot",       "Реле поворотов",                  10, "uncommon", "electro"),
  I("kura_brezent",       "Обрез плотного брезента",         15, "uncommon", "armor"),
  I("poroh_stary",        "Слежавшийся порох",               10, "uncommon", "ammo"),
  I("sero_paket",         "Пакет серы",                      15, "uncommon", "ammo"),
  I("selitra_paket",      "Пакет селитры",                   15, "uncommon", "ammo"),
  I("rukoyatka_pistolet", "Бакелитовая рукоятка",            25, "uncommon", "weapon"),
  I("gajka_stvol",        "Ствольная гайка",                 15, "uncommon", "weapon"),
  I("nakladka_gaz",       "Накладка газовой трубки",         15, "uncommon", "weapon"),
  I("podsumok_maly",      "Малый подсумок",                  30, "uncommon", "armor"),
  I("tsevye_derevo",      "Деревянное цевьё",                17, "uncommon", "weapon"),
  I("tsevye_metall",      "Металлическое цевьё",             17, "uncommon", "weapon"),
  I("tsevye_plastik",     "Полимерное цевьё",                17, "uncommon", "weapon"),
  I("gazovaya_trubka",    "Газовая трубка",                  50, "uncommon", "weapon"),
  I("boyok",              "Стальной боёк",                   10, "uncommon", "weapon"),
  I("priklad_skladnoy",   "Складной приклад",                20, "uncommon", "weapon"),
  I("zashchita_pah",      "Паховый модуль",                  50, "uncommon", "armor"),
  I("razgruzka_osnova",   "Основа нагрудника",               25, "uncommon", "armor"),
  I("tkan_kevlar",        "Кевлар ткань",                    20, "uncommon", "armor"),
  I("stvol_pistolet",     "Пистолетный ствол",               15, "uncommon", "weapon"),
  I("stvol_drobovik",     "Оружейный ствол",                 25, "uncommon", "weapon"),
  I("kolchuga_titan",     "Титановая кольчуга",              35, "uncommon", "armor"),
  I("stvol_vintovka",     "Винтовочный ствол",               100,"uncommon", "weapon"),

  /* ======================= РЕДКИЕ ======================= */
  I("trubka_gilza",       "Пластиковая трубка гильзы",       50, "rare", "ammo"),
  I("rezinovy_uplot",     "Резиновый уплотнитель",           80, "rare", "electro"),
  I("kozha_obrezki",      "Обрезки грубой кожи",             45, "rare", "junk"),
  I("optika_linza",       "Разбитая линза прицела",          70, "rare", "weapon"),
  I("tselik_zad",         "Целик",                           100,"rare", "weapon"),
  I("pruzhina_boevaya",   "Боевая пружина",                  80, "rare", "weapon"),
  I("boyok_ruzhye",       "Боёк для двустволки",             70, "rare", "weapon"),
  I("kolchuga_polotno",   "Фрагмент стальной кольчуги",      120,"rare", "armor"),
  I("sheptalo",           "Шептало",                         110,"rare", "weapon"),
  I("dula_tormoz",        "Дульный тормоз-компенсатор",      60, "rare", "weapon"),
  I("chehol_bronezhilet", "Пустой чехол бронежилета",        100,"rare", "armor"),
  I("shitok_golen",       "Бронещиток на голень",            150,"rare", "armor"),
  I("vkladysh_stvol",     "Ствольный вкладыш",               150,"rare", "weapon"),
  I("usm_detali",         "Детали УСМ",                      200,"rare", "weapon"),
  I("zabralo_polikarbonat","Забрало",                        175,"rare", "armor"),
  I("zatvor_vintovka",    "Продольно-скользящий затвор",     140,"rare", "weapon"),
  I("zatvor_ak",          "Затворная рама",                  190,"rare", "weapon"),
  I("plastina_titan",     "Бронеплиты титановые",            300,"rare", "armor"),

  /* ==================== КРАЙНЕ РЕДКИЕ =================== */
  I("podschechnik",       "Кожаный подщёчник",               500, "legendary", "weapon"),
  I("plastina_stal",      "Стальная бронеплита",             2000,"legendary", "armor",
    { note: "Опт от 50 шт.: скидка 10–20%" }),
  I("plastina_polietilen", "Плита СВМПЭ",                    2000,"legendary", "armor",
    { note: "Опт от 50 шт.: скидка 10–20%" }),
  I("amort_vstavka",      "Демпферная вставка КАП",          2000,"legendary", "armor",
    { note: "Опт от 50 шт.: скидка 10–20%" }),

  /* ======================= ВАНИЛЛА ====================== */
  I("iron",               "Железо",                          20, "vanilla", "vanilla"),
  I("diamond",            "Алмазы",                          50, "vanilla", "vanilla"),
  I("copper",             "Медь",                            5,  "vanilla", "vanilla"),
  I("gold",               "Золото",                          5,  "vanilla", "vanilla"),
  I("gunpowder",          "Порох",                           5,  "vanilla", "vanilla"),

  /* ============================================================
     НЕ ИЗ ПРАЙСА — позиции, которые уже были на сайте и в складах.
     Сохранены, помечены бейджем «вне прайса», цену можно править.
     ============================================================ */
  I("podatnik_magazin",   "Податчик патронов",               10, "other", "weapon", { out: true }),
  I("kryshka_stv_kor",    "Крышка ствольной коробки",        10, "other", "weapon", { out: true }),
  I("transformator",      "Трансформатор",                   15, "other", "electro",{ out: true }),
  I("knopka_tumbler",     "Тумблер",                         3,  "other", "electro",{ out: true }),
  I("rezistor_peremen",   "Резистор",                        3,  "other", "electro",{ out: true }),
  I("antena_teleskop",    "Телескопическая антенна",         10, "other", "electro",{ out: true }),
  I("amortizator_eva",    "Лист ЭВА-пены",                   30, "other", "armor",  { out: true }),
  I("bronepaket_aramid",  "Арамидный мягкий бронепакет",     150,"other", "armor",  { out: true }),
  I("bmp_30mm_bt",        "Снаряды 30 мм БТ",                288,"other", "tech",   { out: true }),
  I("bmp_30mm_ofz",       "Снаряды 30 мм ОФЗ",               296,"other", "tech",   { out: true }),
  I("btr_belt_762",       "Пулемётная лента 7.62 (БТР)",     640,"other", "tech",   { out: true }),
  I("pkt_belt",           "Лента ПКТ 7.62 (БМП)",            320,"other", "tech",   { out: true }),
  I("tank_shell",         "Снаряд 125 мм",                   312,"other", "tech",   { out: true })
];

/* Старые id → актуальные (для импорта бэкапов и чужого localStorage) */
const ALIASES = {
  btr_belt: "btr_belt_762"
};

/* ---------------------------------------------------------------------------
   КРАФТ АВТО — комплектация по системам.
   Количество по умолчанию: 1 шт. на позицию, меняется в интерфейсе.
   ------------------------------------------------------------------------- */
const AUTO_GROUPS = [
  {
    id: "engine",
    title: "Двигатель",
    hint: "Охлаждение и обвес двигателя.",
    items: ["radiator_alyum"]
  },
  {
    id: "transmission",
    title: "Трансмиссия",
    hint: "Привод и подшипники.",
    items: ["shesternya_stal", "podshipnik_rzhavy"]
  },
  {
    id: "electrics",
    title: "Электрика и приборы",
    hint: "Проводка, питание, свет и сигнал.",
    items: ["rele_povorot", "lampa_nakal", "provodka_zhgut",
            "akkum_vzdut", "batareyka_kron", "izolenta_sinyaya"]
  },
  {
    id: "body",
    title: "Кузов и крепёж",
    hint: "Металл, трубки и крепёж.",
    items: ["bolt_gaika", "armatura_kusok", "zhest_list",
            "trubka_med"]
  }
];

/* ---------------------------------------------------------------------------
   БРОНЯ ТИР-5 — рецепты из прайса.
   Цена сета уже включает 15% за сборку.
   ------------------------------------------------------------------------- */
const ARMOR_SETS = [
  {
    id: "light",
    title: "Лёгкая броня тир-5",
    price: 42000,
    accent: "#6fb36b",
    resources: [
      ["tkanevaya_vetosh", 13], ["tkan_kevlar", 61], ["nitki_nylon", 75],
      ["zerkalo_oskolok", 9], ["batareyka_kron", 22], ["kolchuga_titan", 39],
      ["kolchuga_polotno", 55], ["optika_linza", 9], ["plata_tv", 51],
      ["remen_stropa", 78], ["plastina_titan", 9], ["plastina_polietilen", 9],
      ["kozha_obrezki", 55], ["zaklepka_stal", 9]
    ]
  },
  {
    id: "medium",
    title: "Средняя броня тир-5",
    price: 55000,
    accent: "#4f9fd4",
    resources: [
      ["kolchuga_titan", 80], ["rezinovy_uplot", 39], ["tkan_kevlar", 73],
      ["zaklepka_stal", 192], ["podsumok_maly", 27], ["chehol_bronezhilet", 27],
      ["plastina_stal", 9], ["kolchuga_polotno", 99], ["remen_stropa", 39],
      ["kozha_obrezki", 94], ["probka_rezina", 21]
    ]
  },
  {
    id: "heavy",
    title: "Тяжёлая броня тир-5",
    price: 66000,
    accent: "#d4a017",
    resources: [
      ["zaklepka_stal", 34], ["kolchuga_titan", 75], ["tkan_kevlar", 130],
      ["rezinovy_uplot", 119], ["kolchuga_polotno", 82], ["zabralo_polikarbonat", 9],
      ["podsumok_maly", 9], ["zashchita_pah", 9], ["chehol_bronezhilet", 9],
      ["razgruzka_osnova", 9], ["plastina_titan", 9], ["motorchik", 26],
      ["nitki_nylon", 34], ["shitok_golen", 9], ["shesternya_stal", 51],
      ["kozha_obrezki", 73], ["remen_stropa", 26], ["probka_rezina", 21],
      ["amort_vstavka", 9], ["podshipnik_rzhavy", 26]
    ]
  }
];

/* ---------------------------------------------------------------------------
   РЕЦЕПТЫ КРАФТА
   pattern — 3 строки по 3 символа, " " = пустая ячейка.
   key     — символ → id предмета (ittems:<id> = позиция прайса).
   ------------------------------------------------------------------------- */
const CRAFT_ITEMS = {
  "badcars:ammo_assembly_table": "Стол сборки патронов",
  "badcars:car_wrench":          "Автомобильный ключ",
  "badcars:empty_canister":      "Пустая канистра",
  "badcars:rail_layer":          "Путеукладчик",
  "badcars:uaz_assembly_table":  "Стол сборки УАЗ",
  "badcars:winch":               "Лебёдка",
  "minecraft:iron_ingot":        "Железный слиток",
  "minecraft:redstone":          "Редстоун",
  "minecraft:stick":             "Палка"
};

const CRAFTS = [
  { id: "ammo_table", item: "badcars:ammo_assembly_table", count: 1,
    pattern: ["ZZZ", "GPG", "MMM"],
    key: { Z: "ittems:zhest_list", G: "ittems:gilza_vintovka",
           P: "ittems:poroh_banka", M: "ittems:shlak_metall" } },

  { id: "car_wrench", item: "badcars:car_wrench", count: 1,
    pattern: ["BMB", " M ", " M "],
    key: { B: "ittems:bolt_gaika", M: "ittems:shlak_metall" } },

  { id: "canister", item: "badcars:empty_canister", count: 1,
    pattern: ["ZUZ", "Z Z", "ZZZ"],
    key: { Z: "ittems:zhest_list", U: "ittems:rezinovy_uplot" } },

  { id: "rail_layer", item: "badcars:rail_layer", count: 1,
    pattern: ["II ", "IRI", " SI"],
    key: { I: "minecraft:iron_ingot", R: "minecraft:redstone", S: "minecraft:stick" } },

  { id: "uaz_table", item: "badcars:uaz_assembly_table", count: 1,
    pattern: ["ZZZ", "BSB", "MMM"],
    key: { Z: "ittems:zhest_list", B: "ittems:bolt_gaika",
           S: "ittems:shesternya_stal", M: "ittems:shlak_metall" } },

  { id: "winch", item: "badcars:winch", count: 1,
    pattern: ["PMP", "BSB", "ZPZ"],
    key: { P: "ittems:provodka_zhgut", M: "ittems:motorchik",
           B: "ittems:bolt_gaika", S: "ittems:shesternya_stal",
           Z: "ittems:zhest_list" } }
];

/* ---------------------------------------------------------------------------
   СКЛАДЫ ПО УМОЛЧАНИЮ
   ------------------------------------------------------------------------- */
const DEFAULT_PLAYERS = [
  {
    player: "OscarByOsa",
    role: "Участник фракции",
    items: [
      { id: "radiator_alyum", qty: 10 }, { id: "akkum_vzdut", qty: 21 },
      { id: "gilza_drobovik", qty: 84 }, { id: "gvozd_gnuty", qty: 66 },
      { id: "priklad_derevo", qty: 5 }, { id: "diod_most", qty: 10 },
      { id: "bint_gryazny", qty: 21 }, { id: "zatvor_ak", qty: 9 },
      { id: "svinets_kartech", qty: 10 }, { id: "tsevye_metall", qty: 4 },
      { id: "provod_katushka", qty: 5 }, { id: "nitki_nylon", qty: 73 },
      { id: "kozha_obrezki", qty: 44 }, { id: "gazeta_soviet", qty: 141 },
      { id: "tsep_metall", qty: 15 }, { id: "britva_opas", qty: 58 },
      { id: "stvol_drobovik", qty: 10 }, { id: "selitra_paket", qty: 15 },
      { id: "shesternya_stal", qty: 50 }, { id: "gajka_stvol", qty: 3 },
      { id: "antena_teleskop", qty: 25 }, { id: "transformator", qty: 14 },
      { id: "ochi_broken", qty: 74 }, { id: "magnit_ferrit", qty: 31 },
      { id: "kolchuga_polotno", qty: 15 }, { id: "kolchuga_titan", qty: 12 },
      { id: "tselik_zad", qty: 3 }, { id: "kondensator", qty: 76 },
      { id: "zhest_list", qty: 184 }, { id: "tkan_kevlar", qty: 56 },
      { id: "magazin_korpus", qty: 19 }, { id: "shnur_parakord", qty: 2 },
      { id: "mednaya_obmotka", qty: 23 }, { id: "dinamik_maly", qty: 54 },
      { id: "plastina_polietilen", qty: 5 }, { id: "boyok_ruzhye", qty: 4 },
      { id: "ampula_steklo", qty: 25 }, { id: "pruzhina_boevaya", qty: 10 },
      { id: "bronepaket_aramid", qty: 2 }, { id: "rukoyatka_pistolet", qty: 8 },
      { id: "stvol_vintovka", qty: 3 }, { id: "pizh_voylok", qty: 73 },
      { id: "amort_vstavka", qty: 2 }, { id: "gilza_sniper", qty: 18 },
      { id: "tsevye_derevo", qty: 10 }, { id: "pulya_expansiv", qty: 78 },
      { id: "sero_paket", qty: 15 }, { id: "gilza_pistolet", qty: 90 },
      { id: "stvol_pistolet", qty: 22 }, { id: "podatnik_magazin", qty: 11 },
      { id: "tsevye_plastik", qty: 10 }, { id: "tkanevaya_vetosh", qty: 35 },
      { id: "batareyka_kron", qty: 143 }, { id: "rascheska_plast", qty: 63 },
      { id: "rezistor_peremen", qty: 37 }, { id: "rezinovy_uplot", qty: 7 },
      { id: "priklad_skladnoy", qty: 2 }, { id: "radiolampa", qty: 12 },
      { id: "razgruzka_osnova", qty: 8 }, { id: "korobka_patrony", qty: 54 },
      { id: "remen_stropa", qty: 76 }, { id: "drob_svinets", qty: 73 },
      { id: "shlak_metall", qty: 61 }, { id: "zamok_navesnoy", qty: 13 },
      { id: "izolyat_keram", qty: 1 }, { id: "moneta_sssr", qty: 135 },
      { id: "dula_tormoz", qty: 3 }, { id: "provodka_zhgut", qty: 132 },
      { id: "bolt_gaika", qty: 86 }, { id: "trubka_med", qty: 20 },
      { id: "displej_nokia", qty: 36 }, { id: "chehol_bronezhilet", qty: 4 },
      { id: "plata_tv", qty: 46 }, { id: "klyuch_rzhavy", qty: 103 },
      { id: "sheptalo", qty: 2 }, { id: "knopka_tumbler", qty: 27 },
      { id: "poroh_stary", qty: 52 }, { id: "motorchik", qty: 27 },
      { id: "splav_svinets", qty: 6 }, { id: "banka_konservy", qty: 119 },
      { id: "boyok", qty: 8 }, { id: "pulya_serdtsevin", qty: 28 },
      { id: "vkladysh_stvol", qty: 4 }, { id: "rele_povorot", qty: 10 },
      { id: "probka_rezina", qty: 22 }, { id: "plastina_titan", qty: 3 },
      { id: "plastina_stal", qty: 1 }, { id: "plashka_mikro", qty: 26 },
      { id: "ugol_aktiv", qty: 14 }, { id: "podsumok_maly", qty: 7 },
      { id: "armatura_kusok", qty: 28 }, { id: "podschechnik", qty: 1 },
      { id: "usm_detali", qty: 7 }, { id: "izolenta_sinyaya", qty: 22 },
      { id: "optika_linza", qty: 4 }, { id: "lampa_nakal", qty: 1 },
      { id: "zabralo_polikarbonat", qty: 6 }, { id: "zerkalo_oskolok", qty: 41 },
      { id: "gazovaya_trubka", qty: 5 }, { id: "trubka_gilza", qty: 5 },
      { id: "nakladka_gaz", qty: 3 }, { id: "gilza_vintovka", qty: 9 },
      { id: "kura_brezent", qty: 2 }, { id: "kapsul_vosh", qty: 63 },
      { id: "zashchita_pah", qty: 6 }, { id: "plashka_pamyat", qty: 6 },
      { id: "zatvor_vintovka", qty: 6 }, { id: "zaklepka_stal", qty: 8 },
      { id: "kryshka_stv_kor", qty: 1 }, { id: "poroh_banka", qty: 22 },
      { id: "pulya_obolochka", qty: 10 }
    ]
  },
  { player: "Clanzlo", role: "Участник фракции", items: [] },
  { player: "KORBUT", role: "Участник фракции", items: [] }
];
