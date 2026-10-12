import badWordsList from './words.json';
import insultsList from './insults.json';
import safeStemsList from './safe-stems.json';

// Invisible characters that can be hidden inside a word to split it:
// soft hyphen, Arabic letter mark, zero-width space/joiners, direction marks,
// bidi embeddings and isolates, word joiner, and zero-width no-break space.
const INVISIBLE = "\\u00AD\\u061C\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF";
const INVISIBLE_CHARS = new RegExp(`[${INVISIBLE}]`, "g");
const HAS_INVISIBLE = new RegExp(`[${INVISIBLE}]`);
const VISIBLE_RUN = new RegExp(`[^${INVISIBLE}]+`, "g");

// A word is a run of Latin or Arabic letters, diacritics and digits, plus any
// invisible characters inside it. Spaces and punctuation (including Arabic
// ، ؛ ؟ ٪ ۔) separate words.
// Uses explicit ranges instead of \p{...}, which older Hermes (React Native) rejects.
const WORD_PATTERN = new RegExp(
  `[A-Za-z0-9_À-ɏ؀-؋؍-ؚ؜-؞ؠ-٩ٮ-ۓە-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ${INVISIBLE}]+`,
  "g"
);

// Prefixes that attach to the front of a word, tried in this order:
// a conjunction (و، ف), then a preposition (ب، ل، ك), then the article (ال).
// "لل" needs no entry: normalization collapses it to "ل".
const CONJUNCTIONS = ["", "و", "ف"];
const PREPOSITIONS = ["", "ب", "ل", "ك"];
const ARTICLES = ["", "ال"];

// Pronoun suffixes tried by the opt-in stripSuffixes option: my, your (m./f. —
// Iraqi uses ج for feminine), his, her, our, your (pl.), their.
// Normalization turns ة into ه, so a final ة is also tried as a suffix.
const SUFFIXES = ["ي", "ك", "ج", "ه", "ها", "نا", "كم", "هم"];

/**
 * A rule a word needed to match its list entry, reported in ProfanityMatch.rules.
 * Only rules that made a difference are reported: عارة matching عارة has none.
 */
export type MatchRule =
  | "diacritics"     // diacritics or tatweel removed: عَارَة, عـــارة
  | "invisible"      // invisible characters removed: عا‌رة
  | "spelling"       // أ إ آ ٱ → ا, ة → ه, ى → ي: عاره
  | "keyboard"       // Persian/Kurdish keyboard letters ی ک ە: عیر
  | "arabic-digits"  // Arabic-Indic digits read as 0-9: ga٧ba
  | "stretched"      // repeated letters collapsed: عاااارة, للكواد
  | "glued-digits"   // digits in an Arabic word ignored: عارة3
  | "arabizi"        // Arabizi spelling folded: qa7ba → gahba
  | "gaf-as-qaf"     // گ read as ق: گحبة
  | "gaf-as-kaf"     // گ read as ك, as Kurdish typists use it: گسها
  | "prefix"         // attached prefix stripped: بطيزك
  | "suffix"         // pronoun suffix stripped (stripSuffixes): طيزهم
  | "mosul";         // matched the Mosul ر → غ form of the entry (dialects)

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
    .replace(/[23]/g, "")      // ء and ع, often left out ("3ayri" / "ayri")
    .replace(/q/g, "g")        // ق, said and written as g in Iraqi
    .replace(/ou|o/g, "u")     // kosomak / kusomak, sharmouta / sharmota
    .replace(/e/g, "i")        // teezak / tizak, zebi / zibi
    .replace(/(.)\1+/g, "$1");
}

// Normalization, one step per rule so inspect() can tell which ones a match needed.
// Applied in order to both list words and the text, so spelling variants compare equal.
const NORMALIZE_STEPS: { rule: MatchRule | null; apply: (text: string) => string }[] = [
  { rule: "diacritics", apply: (t) => t.replace(/[\u064B-\u065F\u0670\u0640]/g, "") },
  { rule: "invisible", apply: (t) => t.replace(INVISIBLE_CHARS, "") },
  { rule: "spelling", apply: (t) => t.replace(/[أإآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي") },
  { rule: "keyboard", apply: (t) => t.replace(/[ەہۀ]/g, "ه").replace(/ی/g, "ي").replace(/[کڪ]/g, "ك") },
  {
    rule: "arabic-digits",
    apply: (t) => t
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0)),
  },
  { rule: "stretched", apply: (t) => t.replace(/(.)\1+/gu, "$1") },
  { rule: null, apply: (t) => t.toLowerCase() },
  // Digits glued to an Arabic word (عارة3, عا٣رة) are padding; in Arabizi they're letters
  {
    rule: "glued-digits",
    apply: (t) => (HAS_ARABIC.test(t) && /[0-9]/.test(t)
      ? t.replace(/[0-9]/g, "").replace(/(.)\1+/gu, "$1")
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
export type WordSource = "words" | "insults" | "custom";

export interface InspectOptions {
  /**
   * Also return words that matched but were cleared by a safe stem
   * (e.g. بعير "camel" = ب + عير). They carry `suppressedBy`.
   */
  includeSuppressed?: boolean;
}

/** A bad word found by inspect(). */
export interface ProfanityMatch {
  /** The word exactly as written in the input. */
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
   * The dictionary entry it matched, spelled as in its list. For a Mosul form
   * (rule "mosul"), the listed ر spelling: الشرموطة for الشغموطة.
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

/** A match on one reading of a word, before its rules are worked out. */
type ReadingMatch = Omit<WordMatch, "rules"> & { form: string };

interface Entry {
  /** The word as spelled in its list. */
  word: string;
  /** The spelling stored: the word itself, or its generated Mosul form. */
  form: string;
  source: WordSource;
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

  constructor(options: string[] | IraqiBadWordsFilterOptions = {}) {
    // An array is the 1.0 signature: new IraqiBadWordsFilter(customWords)
    const {
      customWords = [], safeWords = [], includeInsults = false, stripSuffixes = false, dialects = [],
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
  }

  /**
   * Normalizes a word or token for comparison: removes diacritics, tatweel and
   * invisible characters, unifies letter variants (أ/ا, ة/ه, ی/ي, ک/ك, …),
   * reads Arabic-Indic digits, collapses stretched letters (عاااارة -> عارة),
   * ignores digits in Arabic words and folds Arabizi. See NORMALIZE_STEPS.
   */
  private normalize(text: string): string {
    return normalizeSteps(text);
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
    }
  }

  /**
   * Checks a single word, also trying it with attached prefixes removed
   * (والكحبة -> كحبة, بطيزك -> طيزك), and suffixes removed when stripSuffixes is on.
   * Returns the matched entry, or null.
   * A match cleared by a safe stem is returned with `suppressedBy` set.
   */
  private matchWord(token: string): WordMatch | null {
    const spelled = this.normalize(token);
    // A گ safe stem matches the word as typed, before it's read as ق or ك
    const spelledSafe = spelled.includes("گ")
      ? this.findSafe(this.prefixCandidates(spelled))
      : undefined;

    let suppressed: WordMatch | null = null;
    for (const reading of this.readings(spelled)) {
      const found = this.matchReading(reading);
      if (!found) continue;

      const { form, ...rest } = found;
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
    const listed = found.prefix + found.form + found.suffix;
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

    return rules;
  }

  /** The word plus each form of it with an attached prefix removed. */
  private prefixCandidates(word: string): { prefix: string; stem: string; suffix: string }[] {
    const candidates = [{ prefix: "", stem: word, suffix: "" }];
    for (const conjunction of CONJUNCTIONS) {
      for (const preposition of PREPOSITIONS) {
        for (const article of ARTICLES) {
          const prefix = conjunction + preposition + article;
          if (prefix && word.startsWith(prefix) && word.length - prefix.length >= 2) {
            candidates.push({ prefix, stem: word.slice(prefix.length), suffix: "" });
          }
        }
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
    if (!match) return null;

    const { word: entry, form, source } = this.words.get(match.stem)!;
    const result: ReadingMatch = {
      normalized: word, entry, form, source, prefix: match.prefix, suffix: match.suffix,
    };

    const safe = this.findSafe(candidates);
    return safe ? { ...result, suppressedBy: safe } : result;
  }

  /**
   * Finds every match in the text, including ones cleared by a safe stem.
   * A token with invisible characters is matched whole first (عا‌رة -> عارة);
   * if that finds nothing profane, each visible piece is tried on its own, so an
   * invisible character between two words can't hide a bad word either.
   */
  private *findMatches(text: string): Generator<ProfanityMatch> {
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

    const matches: ProfanityMatch[] = [];
    for (const match of this.findMatches(text)) {
      if (match.suppressedBy === undefined || options.includeSuppressed) matches.push(match);
    }

    return matches;
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
      result += text.slice(last, start) + placeholder.repeat(end - start);
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
}

export default IraqiBadWordsFilter;
