import badWordsList from './words.json';
import insultsList from './insults.json';
import phrasesList from './phrases.json';
import safeStemsList from './safe-stems.json';

// Invisible characters that can be hidden inside a word to split it:
// soft hyphen, Arabic letter mark, zero-width space/joiners, direction marks,
// bidi embeddings and isolates, word joiner, and zero-width no-break space.
const INVISIBLE = "\\u00AD\\u061C\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF";
const INVISIBLE_CHARS = new RegExp(`[${INVISIBLE}]`, "g");
const HAS_INVISIBLE = new RegExp(`[${INVISIBLE}]`);
const VISIBLE_RUN = new RegExp(`[^${INVISIBLE}]+`, "g");

// A word is a run of Latin (also full-width and mathematical 𝐠𝐚𝐡𝐛𝐚), Greek,
// Cyrillic or Arabic letters, diacritics and digits, plus any invisible
// characters inside it. Spaces, punctuation (including Arabic ، ؛ ؟ ٪ ۔), _ and
// other symbols separate words.
// Uses explicit ranges instead of \p{...} and the u flag, which older Hermes
// (React Native) rejects; mathematical letters are matched as surrogate pairs.
const WORD_CHARS = `A-Za-z0-9À-ɏͰ-Ͽ\u0400-\u04FF؀-؋؍-ؚ؜-؞ؠ-٩ٮ-ۓە-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ０-９Ａ-Ｚａ-ｚ${INVISIBLE}`;
const WORD_UNIT = `(?:[${WORD_CHARS}]|\uD835[\uDC00-\uDFFF])`;
const WORD_PATTERN = new RegExp(`${WORD_UNIT}+`, "g");
const ENDS_WITH_WORD = new RegExp(`${WORD_UNIT}$`);
const STARTS_WITH_WORD = new RegExp(`^${WORD_UNIT}`);

// A bad word split into pieces (ع*ي*ر, ع ي ر) is found by joining the pieces
// again. Gaps longer than this, or with a line break, always separate words.
const MAX_SPLIT_GAP = 5;
// Longest prefix (وبال) plus longest suffix (ها): how much longer than the
// longest entry a joined word can be and still match.
const MAX_AFFIXES = 6;
// How many normalized words a filter remembers before starting over
const NORMALIZED_CACHE_SIZE = 2000;

// A Latin word with @ or $ standing in for a letter: g@hba, $harmoota.
// Symbols at the end are left out, as they're punctuation (kos$ → kos).
const SYMBOL_WORD = /[@$]*[A-Za-z0-9]+(?:[@$]+[A-Za-z0-9]+)*/g;
const SYMBOL_LETTERS: Record<string, string> = { "@": "a", $: "s" };

// Greek and Cyrillic letters that look like Latin ones, read as Latin in a word
// that also has Latin letters: gаhba with a Cyrillic а is gahba.
const LOOKALIKES: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", к: "k", і: "i", ј: "j", ѕ: "s", һ: "h", ԁ: "d", ԛ: "q", ԝ: "w",
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y", І: "I", Ј: "J", Ѕ: "S",
  α: "a", ο: "o", ι: "i", κ: "k", ν: "v", ρ: "p", υ: "u", χ: "x",
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M", Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
};
const LOOKALIKE_CHARS = new RegExp(`[${Object.keys(LOOKALIKES).join("")}]`, "g");

// NFKC turns presentation forms and full-width letters into plain ones
// (ﻋﻴﺮ → عير, ｇａｈｂａ → gahba). Engines built without Unicode data lack it
// or leave text unchanged; there this step does nothing.
// Plain ASCII and Arabic letters without marks never change, so they skip it.
const COMPATIBLE = /^[\x00-\x7F\u0621-\u064A]*$/;
const toCompatibilityForm: (text: string) => string = (() => {
  try {
    if ("ﻋ".normalize("NFKC") === "ع") {
      return (text: string) => (COMPATIBLE.test(text) ? text : text.normalize("NFKC"));
    }
  } catch {
    // normalize is missing or rejects "NFKC"
  }
  return (text: string) => text;
})();

// Prefixes that attach to the front of a word, tried in this order:
// a conjunction (و، ف), then a preposition (ب، ل، ك), then the article (ال);
// or the vocative يا, also as ويا.
// "لل" needs no entry: normalization collapses it to "ل".
const CONJUNCTIONS = ["", "و", "ف"];
const PREPOSITIONS = ["", "ب", "ل", "ك"];
const ARTICLES = ["", "ال"];
// The vocative يا is often typed glued to the word (ياعارة), also before ال,
// which normalization turns from ياال into يال. With و it's also Iraqi ويا
// ("with"): وياعارة, ويالكلب.
const VOCATIVES = ["يا", "يال", "ويا", "ويال"];
const PREFIXES = [
  ...CONJUNCTIONS.flatMap((c) => PREPOSITIONS.flatMap((p) => ARTICLES.map((a) => c + p + a))),
  ...VOCATIVES,
];

// Pronoun suffixes tried by the opt-in stripSuffixes option: my, your (m./f. —
// Iraqi uses ج for feminine), his, her, our, your (pl.), their.
// Normalization turns ة into ه, so a final ة is also tried as a suffix.
const SUFFIXES = ["ي", "ك", "ج", "ه", "ها", "نا", "كم", "هم"];
const SUFFIX_STARTS = new Set(SUFFIXES.flatMap((suffix) => [suffix.slice(0, 1), suffix]));

/**
 * A rule a word needed to match its list entry, reported in ProfanityMatch.rules.
 * Only rules that made a difference are reported: عارة matching عارة has none.
 */
export type MatchRule =
  | "unicode-forms"  // presentation forms and full-width letters read as plain: ﻋﻴﺮ, ｇａｈｂａ
  | "diacritics"     // diacritics or tatweel removed: عَارَة, عـــارة
  | "invisible"      // invisible characters removed: عا‌رة
  | "spelling"       // أ إ آ ٱ → ا, ة → ه, ى → ي: عاره
  | "keyboard"       // Persian/Kurdish keyboard letters ی ک ە پ ڤ: عیر, پورنو
  | "che-as-kaf"     // چ read as ك, as Iraqi says ك in many words: چلب
  | "lookalike"      // Greek/Cyrillic look-alikes in a Latin word: gаhba (Cyrillic а)
  | "arabic-digits"  // Arabic-Indic digits read as 0-9: ga٧ba
  | "stretched"      // repeated letters collapsed: عاااارة, للكواد
  | "glued-digits"   // digits in an Arabic word ignored: عارة3
  | "arabizi"        // Arabizi spelling folded: qa7ba → gahba
  | "gaf-as-qaf"     // گ read as ق: گحبة
  | "gaf-as-kaf"     // گ read as ك, as Kurdish typists use it: گسها
  | "prefix"         // attached prefix stripped: بطيزك
  | "suffix"         // pronoun suffix stripped (stripSuffixes): طيزهم
  | "mosul"          // matched the Mosul ر → غ form of the entry (dialects)
  | "split"          // spaces and special characters removed: ع*ي*ر, ع ي ر
  | "repeated"       // an entry typed several times with no space: عيرعير
  | "symbols"        // @ or $ read as a letter in Arabizi: g@hba, $harmoota
  | "phrase";        // matched a phrase of several words: تعال العب بيه

const HAS_ARABIC = /[\u0600-\uFEFF]/;

/**
 * Folds Arabizi (Arabic written in Latin letters and digits) so spelling
 * variants compare equal: ga7ba / qahba / gahba, kosomak / kusomak,
 * teezak / tizak. Only words made purely of Latin letters and digits are folded.
 */
function foldArabizi(word: string): string {
  if (!/^[a-z0-9]+$/.test(word) || !/[a-z]/.test(word)) return word;

  return word
    .replace(/7/g, "h")        // ح
    .replace(/5/g, "kh")       // خ
    .replace(/6/g, "t")        // ط: 6eezak / teezak
    .replace(/[89]/g, "g")     // ق (and غ), like q below: 9awad / gawad
    .replace(/[23]/g, "")      // ء and ع, often left out ("3ayri" / "ayri")
    .replace(/q/g, "g")        // ق, said and written as g in Iraqi
    .replace(/ou|o/g, "u")     // kosomak / kusomak, sharmouta / sharmota
    .replace(/e/g, "i")        // teezak / tizak, zebi / zibi
    .replace(/(.)\1+/g, "$1");
}

// Normalization, one step per rule so inspect() can tell which ones a match needed.
// Applied in order to both list words and the text, so spelling variants compare equal.
const NORMALIZE_STEPS: { rule: MatchRule | null; apply: (text: string) => string }[] = [
  // NFKC writes a few isolated diacritic forms as space + mark; the space is dropped
  { rule: "unicode-forms", apply: (t) => toCompatibilityForm(t).replace(/\s/g, "") },
  { rule: "diacritics", apply: (t) => t.replace(/[\u064B-\u065F\u0670\u0640]/g, "") },
  { rule: "invisible", apply: (t) => t.replace(INVISIBLE_CHARS, "") },
  { rule: "spelling", apply: (t) => t.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي") },
  {
    rule: "keyboard",
    apply: (t) => t.replace(/[ەہۀ]/g, "ه").replace(/ی/g, "ي").replace(/[کڪ]/g, "ك").replace(/پ/g, "ب").replace(/ڤ/g, "ف"),
  },
  // Iraqi says many words with ك as چ (كلب → چلب) and some write them that way
  { rule: "che-as-kaf", apply: (t) => t.replace(/چ/g, "ك") },
  {
    rule: "lookalike",
    apply: (t) => (/[A-Za-z]/.test(t) ? t.replace(LOOKALIKE_CHARS, (letter) => LOOKALIKES[letter]) : t),
  },
  {
    rule: "arabic-digits",
    apply: (t) => t
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0)),
  },
  { rule: "stretched", apply: (t) => t.replace(/(.)\1+/g, "$1") },
  { rule: null, apply: (t) => t.toLowerCase() },
  // Digits glued to an Arabic word (عارة3, عا٣رة) are padding; in Arabizi they're letters
  {
    rule: "glued-digits",
    apply: (t) => (HAS_ARABIC.test(t) && /[0-9]/.test(t)
      ? t.replace(/[0-9]/g, "").replace(/(.)\1+/g, "$1")
      : t),
  },
  { rule: "arabizi", apply: (t) => (HAS_ARABIC.test(t) ? t : foldArabizi(t)) },
];

/** Runs the normalization steps, optionally leaving one out. */
function normalizeSteps(text: string, skip = -1): string {
  return NORMALIZE_STEPS.reduce((t, step, i) => (i === skip ? t : step.apply(t)), text);
}

export interface IraqiBadWordsFilterOptions {
  /**
   * Extra words to filter, on top of the built-in list. Can be your own JSON
   * word file: `customWords: require('./my-words.json')`.
   */
  customWords?: string[];
  /**
   * Extra safe stems, on top of the built-in safe-stems.json: clean words that
   * would otherwise match once a prefix or suffix is stripped, like the
   * built-in بعير ("camel" = ب + عير). Their prefixed and suffixed forms are
   * safe too (وبعيرك).
   * Can be your own JSON file: `safeWords: require('./my-safe-words.json')`.
   */
  safeWords?: string[];
  /**
   * Also filter milder insults (كلب, حمار, قندرة, …). Off by default because
   * many of them are everyday words ("عندي كلب", "جلب لي هدية").
   */
  includeInsults?: boolean;
  /**
   * Also filter phrases (phrases.json) whose words are clean on their own but
   * vulgar together (تعال العب بيه). Off by default because the same words can
   * be meant literally ("come play with it").
   */
  includePhrases?: boolean;
  /**
   * Extra phrases to filter, whatever includePhrases is. Can be your own JSON
   * file: `customPhrases: require('./my-phrases.json')`.
   */
  customPhrases?: string[];
  /**
   * Also match words with a pronoun suffix the list doesn't spell out
   * (طيزهم -> طيز). Off by default: it widens matching, so it can flag
   * clean words that happen to end like a bad word plus a suffix.
   */
  stripSuffixes?: boolean;
  /**
   * Regional pronunciations to also match. "mosul": ر said as غ, so every entry
   * and safe stem with ر also matches its غ form (عير -> عيغ, بعير -> بعيغ).
   * The ر forms keep matching. Off by default.
   */
  dialects?: Dialect[];
}

/** A regional pronunciation the filter can also match. */
export type Dialect = "mosul";

/** Which list a dictionary entry came from. */
export type WordSource = "words" | "insults" | "phrases" | "custom";

export interface InspectOptions {
  /**
   * Also return words that matched but were cleared by a safe stem
   * (e.g. بعير "camel" = ب + عير). They carry `suppressedBy`.
   */
  includeSuppressed?: boolean;
}

/** A bad word found by inspect(). */
export interface ProfanityMatch {
  /** The word (or phrase) exactly as written in the input. */
  token: string;
  /**
   * Offset of the word in the input; text.slice(start, end) === token.
   * Counted in JavaScript string units (UTF-16), like String.prototype.slice.
   */
  start: number;
  /** Offset just past the end of the word in the input. */
  end: number;
  /**
   * The word after normalization (diacritics, stretched letters, … removed).
   * For a word with گ, the reading that matched: گ as ق or as ك.
   */
  normalized: string;
  /**
   * The dictionary entry (word or phrase) it matched, spelled as in its list. For a Mosul form
   * (rule "mosul"), the listed ر spelling: شرموطة for شغموطة.
   */
  entry: string;
  /** The list the entry came from. */
  source: WordSource;
  /** The prefix stripped before matching (e.g. "وال"), or "" for a direct match. */
  prefix: string;
  /** The suffix stripped before matching (only with stripSuffixes), or "". */
  suffix: string;
  /** The rules the word needed to match the entry, e.g. ["prefix", "arabizi"]. */
  rules: MatchRule[];
  /**
   * The safe stem that cleared this match, spelled as in safe-stems.json or safeWords.
   * Only set on matches returned with `includeSuppressed`; these are not profane.
   */
  suppressedBy?: string;
}

type WordMatch = Omit<ProfanityMatch, "token" | "start" | "end">;

/**
 * A match on one reading of a word, before its rules are worked out.
 * `repeats` is set when the word is the matched form typed that many times.
 */
type ReadingMatch = Omit<WordMatch, "rules"> & { form: string; repeats?: number };

interface Entry {
  /** The word as spelled in its list. */
  word: string;
  /** The spelling stored: the word itself, or its generated Mosul form. */
  form: string;
  source: WordSource;
}

/**
 * One word of a phrase: each alternative's normalized key -> the alternative
 * as listed, and the spelling stored (it, or its generated Mosul form).
 */
type PhraseWord = Map<string, { word: string; form: string }>;

interface Phrase {
  /** The phrase as spelled in its list, alternatives included: قوم|كوم بيه|بينو. */
  phrase: string;
  /** Its words, each a set of alternatives. */
  words: PhraseWord[];
  source: WordSource;
}

/** The words of a text or list entry, as the filter splits them. */
function wordsOf(text: string): string[] {
  return text.match(new RegExp(WORD_PATTERN.source, "g")) ?? [];
}

export class IraqiBadWordsFilter {
  // Normalized word -> the entry it came from
  private words: Map<string, Entry>;

  // Clean words that would otherwise match after a prefix is stripped
  // (e.g. بعير "camel" = ب + عير). Also covers their prefixed and suffixed
  // forms (وبعيرك). Listed in safe-stems.json, plus the safeWords option.
  private safeStems: { normalized: string; word: string }[] = [];

  private stripSuffixes: boolean;

  private mosul: boolean;

  // Every start of a normalized entry (ع, عي, عير, …) and the longest entry's
  // length, to stop joining split pieces once no entry can match
  private entryStarts = new Set<string>();

  private longest = 0;

  // Recently normalized words: each pass over a text normalizes the same words
  private normalized = new Map<string, string>();

  // Phrases by their first normalized word, then by all their normalized words
  private phrases = new Map<string, Map<string, Phrase>>();

  constructor(options: string[] | IraqiBadWordsFilterOptions = {}) {
    // An array is the 1.0 signature: new IraqiBadWordsFilter(customWords)
    const {
      customWords = [], safeWords = [], includeInsults = false, includePhrases = false,
      customPhrases = [], stripSuffixes = false, dialects = [],
    } = Array.isArray(options) ? { customWords: options } : options;

    // Combine the external JSON file lists with any custom words passed at runtime
    this.words = new Map();
    this.stripSuffixes = stripSuffixes;
    this.mosul = dialects.includes("mosul");
    this.addSafeStems(safeStemsList);
    this.addSafeStems(safeWords);
    this.addEntries(badWordsList, "words");
    if (includeInsults) this.addEntries(insultsList, "insults");
    this.addEntries(customWords, "custom");
    if (includePhrases) this.addPhraseEntries(phrasesList, "phrases");
    this.addPhraseEntries(customPhrases, "custom");
  }

  /**
   * Normalizes a word or token for comparison: removes diacritics, tatweel and
   * invisible characters, unifies letter variants (أ/ا, ة/ه, ی/ي, ک/ك, چ/ك, …),
   * reads Arabic-Indic digits, collapses stretched letters (عاااارة -> عارة),
   * ignores digits in Arabic words and folds Arabizi. See NORMALIZE_STEPS.
   */
  private normalize(text: string): string {
    let result = this.normalized.get(text);
    if (result === undefined) {
      if (this.normalized.size >= NORMALIZED_CACHE_SIZE) this.normalized.clear();
      result = normalizeSteps(text);
      this.normalized.set(text, result);
    }

    return result;
  }

  /**
   * The ways a normalized word can be read. Iraqi Arabic writes ق as گ, but
   * Kurdish typists sometimes use گ for ك, so a word with گ is tried both ways.
   */
  private readings(word: string): string[] {
    return word.includes("گ") ? [word.replace(/گ/g, "ق"), word.replace(/گ/g, "ك")] : [word];
  }

  /** A list word plus its regional forms (عير -> عير, عيغ with the Mosul dialect). */
  private dialectForms(word: string): string[] {
    return this.mosul && word.includes("ر") ? [word, word.replace(/ر/g, "غ")] : [word];
  }

  /** The key a list word is stored under. A گ in a list entry means ق. */
  private entryKey(word: string): string {
    return this.normalize(word).replace(/گ/g, "ق");
  }

  /**
   * A word list with surrounding whitespace trimmed and entries that are empty
   * after normalization skipped. A stray "" in a user's file would otherwise
   * match a lone tatweel as a word, or clear every match as a safe stem.
   */
  private cleanList(list: string[]): string[] {
    return list
      .filter((word) => typeof word === "string")
      .map((word) => word.trim())
      .filter((word) => this.entryKey(word) !== "");
  }

  /**
   * Adds safe stems from one list. A safe stem written with گ protects only
   * words spelled with گ (گلب "heart"), so it isn't read as ق or ك.
   */
  private addSafeStems(stems: string[]): void {
    for (const stem of this.cleanList(stems)) {
      for (const word of this.dialectForms(stem)) {
        this.safeStems.push({ normalized: this.normalize(word), word });
      }
    }
  }

  /**
   * Adds words from one list. A word already present keeps its first source.
   */
  private addEntries(listWords: string[], source: WordSource): void {
    const newWords = this.cleanList(listWords);
    // Listed spellings first, so a word listed in its own right (عيغ) isn't
    // reported as a generated Mosul form
    const forms = [
      ...newWords.map((word) => ({ word, form: word })),
      ...newWords.flatMap((word) => this.dialectForms(word).slice(1).map((form) => ({ word, form }))),
    ];
    for (const { word, form } of forms) {
      const key = this.entryKey(form);
      if (!this.words.has(key)) this.words.set(key, { word, form, source });
      for (let i = 1; i <= key.length; i++) this.entryStarts.add(key.slice(0, i));
      this.longest = Math.max(this.longest, key.length);
    }
  }

  /**
   * Reads a listed phrase: words separated by spaces, each with its alternatives
   * separated by | (قوم|كوم بيه|بينو). Punctuation in a word is ignored, and
   * alternatives that are empty after normalization (a lone tatweel) are left
   * out. With the Mosul dialect, an alternative with ر also has its غ form.
   * Phrases that match the same text get the same id.
   */
  private parsePhrase(phrase: string): { id: string; words: PhraseWord[] } {
    const words: PhraseWord[] = [];
    for (const slot of phrase.split(/\s+/)) {
      const alternatives: PhraseWord = new Map();
      for (const word of slot.split("|").map((alternative) => wordsOf(alternative).join(""))) {
        for (const form of this.dialectForms(word)) {
          const key = this.entryKey(form);
          if (key && !alternatives.has(key)) alternatives.set(key, { word, form });
        }
      }
      if (alternatives.size) words.push(alternatives);
    }

    const id = words.map((alternatives) => [...alternatives.keys()].sort().join("|")).join(" ");
    return { id, words };
  }

  /**
   * Adds phrases from one list, indexed by each alternative of their first word.
   * A phrase already present keeps its first source.
   */
  private addPhraseEntries(listPhrases: string[], source: WordSource): void {
    for (const phrase of this.cleanList(listPhrases)) {
      const { id, words } = this.parsePhrase(phrase);
      for (const first of words[0]?.keys() ?? []) {
        const byId = this.phrases.get(first) ?? new Map<string, Phrase>();
        if (!byId.has(id)) byId.set(id, { phrase, words, source });
        this.phrases.set(first, byId);
      }
    }
  }

  /**
   * The first word of a phrase with attached prefixes removed, and also the
   * Iraqi progressive د (دقوم بيه, ودقوم بيه).
   */
  private phraseCandidates(word: string): { prefix: string; stem: string }[] {
    const candidates = this.prefixCandidates(word);
    const progressive = candidates
      .filter(({ stem }) => stem.startsWith("د") && stem.length >= 3)
      .map(({ prefix, stem }) => ({ prefix: prefix + "د", stem: stem.slice(1) }));

    return [...candidates, ...progressive];
  }

  /**
   * Checks a single word, also trying it with attached prefixes removed
   * (والكحبة -> كحبة, بطيزك -> طيزك), and suffixes removed when stripSuffixes is on.
   * Returns the matched entry, or null.
   * A match cleared by a safe stem is returned with `suppressedBy` set.
   * Pass `spelled` when the token is already normalized.
   */
  private matchWord(token: string, spelled = this.normalize(token)): WordMatch | null {
    // A گ safe stem matches the word as typed, before it's read as ق or ك
    const spelledSafe = spelled.includes("گ")
      ? this.findSafe(this.prefixCandidates(spelled))
      : undefined;

    let suppressed: WordMatch | null = null;
    for (const reading of this.readings(spelled)) {
      const found = this.matchReading(reading);
      if (!found) continue;

      const { form, repeats, ...rest } = found;
      const match: WordMatch = { ...rest, rules: this.explain(token, found, spelled, reading) };
      if (match.suppressedBy === undefined && spelledSafe) match.suppressedBy = spelledSafe;
      if (match.suppressedBy === undefined) return match;
      suppressed = suppressed ?? match;
    }

    return suppressed;
  }

  /**
   * Works out which rules a match needed, by comparing the typed word with the
   * listed spelling (plus any stripped prefix and suffix). A normalization rule
   * counts only if leaving it out would keep them apart: عاااارة vs عارة needs
   * "stretched" but not "spelling", since both have ة.
   */
  private explain(token: string, found: ReadingMatch, spelled: string, reading: string): MatchRule[] {
    const listed = (found.prefix + found.form + found.suffix).repeat(found.repeats ?? 1);
    const gaf = reading === spelled ? "" : reading === spelled.replace(/گ/g, "ق") ? "ق" : "ك";
    // Compare after reading گ the way the match did (a گ in a list entry means ق)
    const same = (typed: string, list: string) =>
      typed.replace(/گ/g, gaf || "گ") === list.replace(/گ/g, "ق");

    const rules: MatchRule[] = [];
    NORMALIZE_STEPS.forEach(({ rule }, i) => {
      if (rule && !same(normalizeSteps(token, i), normalizeSteps(listed, i))) rules.push(rule);
    });

    if (gaf && normalizeSteps(token) !== normalizeSteps(listed)) {
      rules.push(gaf === "ق" ? "gaf-as-qaf" : "gaf-as-kaf");
    }
    if (found.prefix) rules.push("prefix");
    if (found.suffix) rules.push("suffix");
    if (found.form !== found.entry) rules.push("mosul");
    if (found.repeats) rules.push("repeated");

    return rules;
  }

  /** The word plus each form of it with an attached prefix removed. */
  private prefixCandidates(word: string): { prefix: string; stem: string; suffix: string }[] {
    const candidates = [{ prefix: "", stem: word, suffix: "" }];
    for (const prefix of PREFIXES) {
      if (prefix && word.startsWith(prefix) && word.length - prefix.length >= 2) {
        candidates.push({ prefix, stem: word.slice(prefix.length), suffix: "" });
      }
    }

    return candidates;
  }

  /** The first safe stem one of the candidates starts with, as listed. */
  private findSafe(candidates: { stem: string }[]): string | undefined {
    for (const { stem } of candidates) {
      const safe = this.safeStems.find(({ normalized }) => stem.startsWith(normalized));
      if (safe) return safe.word;
    }

    return undefined;
  }

  /** Matches one normalized reading of a word. */
  private matchReading(word: string): ReadingMatch | null {
    const direct = this.words.get(word);
    if (direct) {
      return {
        normalized: word, entry: direct.word, form: direct.form, source: direct.source, prefix: "", suffix: "",
      };
    }

    const candidates = this.prefixCandidates(word);

    // Suffix forms go last, so a match that needs less stripping wins
    if (this.stripSuffixes) {
      for (const { prefix, stem } of [...candidates]) {
        for (const suffix of SUFFIXES) {
          if (stem.endsWith(suffix) && stem.length - suffix.length >= 2) {
            candidates.push({ prefix, stem: stem.slice(0, -suffix.length), suffix });
          }
        }
      }
    }

    const match = candidates.find(({ stem }) => this.words.has(stem));
    if (!match) return this.matchRepeated(word);

    const { word: entry, form, source } = this.words.get(match.stem)!;
    const result: ReadingMatch = {
      normalized: word, entry, form, source, prefix: match.prefix, suffix: match.suffix,
    };

    const safe = this.findSafe(candidates);
    return safe ? { ...result, suppressedBy: safe } : result;
  }

  /**
   * Matches a word that is one entry typed several times with no space
   * (عيرعير, gahbagahba), each time with the same prefix and suffix.
   * Only an exact repeat counts, so a clean word that merely contains a bad
   * word still isn't flagged, and a safe stem clears the whole word (كسكس).
   */
  private matchRepeated(word: string): ReadingMatch | null {
    for (let size = 1; size <= word.length / 2; size++) {
      if (word.length % size !== 0) continue;
      const unit = word.slice(0, size);
      if (unit.repeat(word.length / size) !== word) continue;

      // The shortest repeating unit; a longer one would repeat it too
      const found = this.matchReading(unit);
      if (!found) return null;
      const safe = found.suppressedBy ?? this.findSafe(this.prefixCandidates(word));
      const result: ReadingMatch = { ...found, normalized: word, repeats: word.length / size };
      return safe ? { ...result, suppressedBy: safe } : result;
    }

    return null;
  }

  /**
   * Finds every match in the text, including ones cleared by a safe stem: whole
   * words, phrases, words split into pieces, and Arabizi words with symbols as
   * letters. Matches from different passes can overlap; inspect() resolves that.
   */
  private *findMatches(text: string): Generator<ProfanityMatch> {
    yield* this.findWordMatches(text);
    yield* this.findPhraseMatches(text);
    yield* this.findSplitMatches(text);
    yield* this.findSymbolMatches(text);
  }

  /**
   * Finds listed phrases: their words one after another, with only spaces or
   * punctuation between them, each one of its alternatives. Each word is
   * normalized like any other, and the first can carry an attached prefix
   * (وتعال العب بيه) or the progressive د (دقوم بيه). The longest phrase wins.
   */
  private *findPhraseMatches(text: string): Generator<ProfanityMatch> {
    if (!this.phrases.size) return;

    const pattern = new RegExp(WORD_PATTERN.source, "g");
    const tokens: { text: string; start: number; end: number }[] = [];
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text))) {
      tokens.push({ text: found[0], start: found.index, end: found.index + found[0].length });
    }

    // The reading of the token at i that is one of the word's alternatives, or undefined
    const readAs = (i: number, word: PhraseWord) => this.readings(this.normalize(tokens[i].text)).find((r) => word.has(r));

    for (let i = 0; i < tokens.length; i++) {
      const spelled = this.normalize(tokens[i].text);
      let best: { phrase: Phrase; prefix: string; reading: string; stem: string } | null = null;
      for (const reading of this.readings(spelled)) {
        for (const { prefix, stem } of this.phraseCandidates(reading)) {
          for (const phrase of this.phrases.get(stem)?.values() ?? []) {
            const length = phrase.words.length;
            const fits = i + length <= tokens.length
              && phrase.words.every((word, k) => k === 0 || readAs(i + k, word) !== undefined);
            if (fits && (!best || length > best.phrase.words.length)) best = { phrase, prefix, reading, stem };
          }
        }
      }
      if (!best) continue;

      const { phrase, prefix, reading, stem } = best;
      const tokensMatched = tokens.slice(i, i + phrase.words.length);
      const keys = tokensMatched.map((_, k) => (k === 0 ? stem : readAs(i + k, phrase.words[k])!));
      const rules = new Set<MatchRule>();
      tokensMatched.forEach((token, k) => {
        const { word, form } = phrase.words[k].get(keys[k])!;
        const found: ReadingMatch = {
          normalized: "", entry: word, form, source: phrase.source, prefix: k === 0 ? prefix : "", suffix: "",
        };
        const typed = this.normalize(token.text);
        for (const rule of this.explain(token.text, found, typed, k === 0 ? reading : keys[k])) rules.add(rule);
      });
      rules.add("phrase");

      const start = tokensMatched[0].start;
      const end = tokensMatched[tokensMatched.length - 1].end;
      yield {
        token: text.slice(start, end), start, end,
        normalized: [reading, ...keys.slice(1)].join(" "),
        entry: phrase.phrase, source: phrase.source, prefix, suffix: "", rules: [...rules],
      };
      i += phrase.words.length - 1;
    }
  }

  /**
   * Matches each word in the text.
   * A token with invisible characters is matched whole first (عا‌رة -> عارة);
   * if that finds nothing profane, each visible piece is tried on its own, so an
   * invisible character between two words can't hide a bad word either.
   */
  private *findWordMatches(text: string): Generator<ProfanityMatch> {
    // A fresh regex so the shared global pattern's lastIndex is never touched
    const pattern = new RegExp(WORD_PATTERN.source, "g");
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text))) {
      const token = found[0];
      const start = found.index;
      const whole = this.matchWord(token);
      const wholeMatch = whole && { token, start, end: start + token.length, ...whole };

      if ((whole && whole.suppressedBy === undefined) || !HAS_INVISIBLE.test(token)) {
        if (wholeMatch) yield wholeMatch;
        continue;
      }

      const pieces: ProfanityMatch[] = [];
      const piecePattern = new RegExp(VISIBLE_RUN.source, "g");
      let piece: RegExpExecArray | null;
      while ((piece = piecePattern.exec(token))) {
        const match = this.matchWord(piece[0]);
        const pieceStart = start + piece.index;
        if (match) pieces.push({ token: piece[0], start: pieceStart, end: pieceStart + piece[0].length, ...match });
      }

      if (pieces.length) yield* pieces;
      else if (wholeMatch) yield wholeMatch;
    }
  }

  /**
   * Whether two neighbouring pieces can be one split word. The gap between them
   * must be short and on one line, and either have no spaces (عي*ر, شرم.وطة),
   * sit between single letters (ع ي ر), or have a symbol between pieces of at
   * most two letters (عي * ر). Normal sentences (انا و انت, كلمة، كلمة) stay apart.
   * `size` gives a piece's normalized length, worked out only when needed.
   */
  private joinable(gap: string, size: (side: 0 | 1) => number): boolean {
    if (gap.length > MAX_SPLIT_GAP || gap.includes("\n")) return false;
    if (!/\s/.test(gap)) return true;
    if (size(0) <= 1 && size(1) <= 1) return true;
    return /\S/.test(gap) && size(0) <= 2 && size(1) <= 2;
  }

  /**
   * Whether a normalized word, or a longer one made by joining more pieces to
   * it, could still match an entry: it must be the start of a prefix, or a
   * prefix plus the start of an entry (or of an entry and a suffix). A word
   * with no letters yet (digits only) always could.
   */
  private couldMatch(spelled: string): boolean {
    if (/^[0-9]*$/.test(spelled)) return true;

    return this.readings(spelled).some((word) => PREFIXES.some((prefix) => {
      if (!word.startsWith(prefix)) return prefix.startsWith(word);

      const stem = word.slice(prefix.length);
      if (stem === "" || this.entryStarts.has(stem)) return true;
      return this.stripSuffixes && [1, 2].some((n) => stem.length > n
        && this.words.has(stem.slice(0, -n)) && SUFFIX_STARTS.has(stem.slice(-n)));
    }));
  }

  /**
   * Finds bad words split into pieces by symbols or spaces (ع*ي*ر, ع ي ر,
   * g-a-h-b-a) by joining neighbouring pieces again. From each piece, the
   * longest joined stretch that matches wins, and its span covers the separators.
   */
  private *findSplitMatches(text: string): Generator<ProfanityMatch> {
    const pattern = new RegExp(WORD_PATTERN.source, "g");
    const pieces: { text: string; start: number; end: number; size?: number }[] = [];
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text))) {
      pieces.push({ text: found[0], start: found.index, end: found.index + found[0].length });
    }

    // joins[i]: piece i can be joined to the piece before it
    const sizeOf = (i: number) => (pieces[i].size ??= this.normalize(pieces[i].text).length);
    const joins = pieces.map((piece, i) => i > 0
      && this.joinable(text.slice(pieces[i - 1].end, piece.start), (side) => sizeOf(i - 1 + side)));

    for (let first = 0; first < pieces.length - 1;) {
      let best: { match: WordMatch; last: number } | null = null;
      let joined = pieces[first].text;
      for (let last = first + 1; last < pieces.length && joins[last]; last++) {
        joined += pieces[last].text;
        const spelled = this.normalize(joined);
        if (spelled.length > this.longest + MAX_AFFIXES || !this.couldMatch(spelled)) break;

        // A longer stretch wins, unless it's only cleared by a safe stem
        const match = this.matchWord(joined, spelled);
        if (match && (!best || match.suppressedBy === undefined || best.match.suppressedBy !== undefined)) {
          best = { match, last };
        }
      }

      if (!best) {
        first++;
        continue;
      }

      const { start } = pieces[first];
      const { end } = pieces[best.last];
      yield { token: text.slice(start, end), start, end, ...best.match, rules: [...best.match.rules, "split"] };
      first = best.last + 1;
    }
  }

  /**
   * Finds Arabizi words with @ or $ standing in for a letter (g@hba, $harmoota).
   * A word glued to other letters, like an Arabic word, is left to the other passes.
   */
  private *findSymbolMatches(text: string): Generator<ProfanityMatch> {
    const pattern = new RegExp(SYMBOL_WORD.source, "g");
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text))) {
      const token = found[0];
      const start = found.index;
      const end = start + token.length;
      if (!/[@$]/.test(token) || !/[A-Za-z]/.test(token)) continue;
      if (ENDS_WITH_WORD.test(text.slice(Math.max(0, start - 2), start))) continue;
      if (STARTS_WITH_WORD.test(text.slice(end, end + 2))) continue;

      const match = this.matchWord(token.replace(/[@$]/g, (symbol) => SYMBOL_LETTERS[symbol]));
      if (match) yield { token, start, end, ...match, rules: ["symbols", ...match.rules] };
    }
  }

  /**
   * Puts matches in text order and drops overlapping ones, so each span is
   * reported and masked once. Real matches go before ones cleared by a safe
   * stem, then earlier and longer before later or shorter: ع*ي*ر is one match,
   * not also its pieces.
   */
  private resolveOverlaps(matches: ProfanityMatch[]): ProfanityMatch[] {
    const byPosition = (a: ProfanityMatch, b: ProfanityMatch) => a.start - b.start || b.end - a.end;
    const real = matches.filter((match) => match.suppressedBy === undefined).sort(byPosition);
    const suppressed = matches.filter((match) => match.suppressedBy !== undefined).sort(byPosition);

    const kept: ProfanityMatch[] = [];
    for (const match of [...real, ...suppressed]) {
      if (!kept.some((other) => match.start < other.end && other.start < match.end)) kept.push(match);
    }

    return kept.sort(byPosition);
  }

  /**
   * Checks if a given text contains profane words.
   */
  public isProfane(text: string): boolean {
    if (!text) return false;

    for (const match of this.findMatches(text)) {
      if (match.suppressedBy === undefined) return true;
    }

    return false;
  }

  /**
   * Lists every bad word in the text with its position in the original input
   * and why it matched, e.g. to highlight words or review a match before blocking.
   */
  public inspect(text: string, options: InspectOptions = {}): ProfanityMatch[] {
    if (!text) return [];

    return this.resolveOverlaps([...this.findMatches(text)])
      .filter((match) => match.suppressedBy === undefined || options.includeSuppressed);
  }

  /**
   * Replaces profane words with a placeholder string.
   */
  public clean(text: string, placeholder: string = "*"): string {
    if (!text) return "";

    // Built from inspect() so masking and reporting always agree
    let result = "";
    let last = 0;
    for (const { start, end } of this.inspect(text)) {
      // One placeholder per character: 𝐠 or an emoji is two string units but one character
      result += text.slice(last, start) + placeholder.repeat(Array.from(text.slice(start, end)).length);
      last = end;
    }

    return result + text.slice(last);
  }

  /**
   * Dynamically add words to the active dictionary.
   */
  public addWords(newWords: string[]): void {
    this.addEntries(newWords, "custom");
  }

  /**
   * Add safe stems to this filter, like the safeWords option.
   */
  public addSafeWords(newWords: string[]): void {
    this.addSafeStems(newWords);
  }

  /**
   * Remove words from the active filter dictionary.
   */
  public removeWords(wordsToRemove: string[]): void {
    for (const word of wordsToRemove.flatMap((w) => this.dialectForms(w))) {
      this.words.delete(this.entryKey(word));
    }
  }

  /**
   * Add phrases to this filter, like the customPhrases option.
   */
  public addPhrases(newPhrases: string[]): void {
    this.addPhraseEntries(newPhrases, "custom");
  }

  /**
   * Remove phrases from this filter, for example a built-in phrase you don't want
   * flagged. Pass the phrase as listed, alternatives included.
   */
  public removePhrases(phrasesToRemove: string[]): void {
    for (const phrase of this.cleanList(phrasesToRemove)) {
      const { id, words } = this.parsePhrase(phrase);
      for (const first of words[0]?.keys() ?? []) {
        const byId = this.phrases.get(first);
        byId?.delete(id);
        if (byId && !byId.size) this.phrases.delete(first);
      }
    }
  }
}

export default IraqiBadWordsFilter;
