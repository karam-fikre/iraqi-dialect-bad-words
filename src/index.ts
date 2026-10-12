import badWordsList from './words.json';
import insultsList from './insults.json';
import safeStemsList from './safe-stems.json';

// A word is a run of Latin or Arabic letters, diacritics and digits.
// Spaces and punctuation (including Arabic ، ؛ ؟ ٪ ۔) separate words.
// Uses explicit ranges instead of \p{...}, which older Hermes (React Native) rejects.
const WORD_PATTERN =
  /[A-Za-z0-9_À-ɏ؀-؋؍-ؚ؜-؞ؠ-٩ٮ-ۓە-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-ﻼ]+/g;

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

export interface IraqiBadWordsFilterOptions {
  /** Extra words to filter, on top of the built-in list. */
  customWords?: string[];
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
}

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
  /** The word after normalization (diacritics, stretched letters, … removed). */
  normalized: string;
  /** The dictionary entry it matched, spelled as in its list. */
  entry: string;
  /** The list the entry came from. */
  source: WordSource;
  /** The prefix stripped before matching (e.g. "وال"), or "" for a direct match. */
  prefix: string;
  /** The suffix stripped before matching (only with stripSuffixes), or "". */
  suffix: string;
  /**
   * The safe stem that cleared this match, spelled as in safe-stems.json.
   * Only set on matches returned with `includeSuppressed`; these are not profane.
   */
  suppressedBy?: string;
}

type WordMatch = Omit<ProfanityMatch, "token" | "start" | "end">;

interface Entry {
  /** The word as spelled in its list. */
  word: string;
  source: WordSource;
}

export class IraqiBadWordsFilter {
  // Normalized word -> the entry it came from
  private words: Map<string, Entry>;

  // Clean words that would otherwise match after a prefix is stripped
  // (e.g. بعير "camel" = ب + عير). Also covers their prefixed and suffixed
  // forms (وبعيرك). Listed in safe-stems.json.
  private safeStems: { normalized: string; word: string }[];

  private stripSuffixes: boolean;

  constructor(options: string[] | IraqiBadWordsFilterOptions = {}) {
    // An array is the 1.0 signature: new IraqiBadWordsFilter(customWords)
    const { customWords = [], includeInsults = false, stripSuffixes = false } = Array.isArray(options)
      ? { customWords: options }
      : options;

    // Combine the external JSON file lists with any custom words passed at runtime
    this.words = new Map();
    this.stripSuffixes = stripSuffixes;
    this.safeStems = safeStemsList.map((word) => ({ normalized: this.normalize(word), word }));
    this.addEntries(badWordsList, "words");
    if (includeInsults) this.addEntries(insultsList, "insults");
    this.addEntries(customWords, "custom");
  }

  /**
   * Normalizes Arabic text so spelling variants compare equal:
   * removes diacritics (Tashkeel) and tatweel, unifies Alef/Teh Marbuta/Alef Maksura
   * forms, and collapses stretched letters (عاااارة -> عارة).
   */
  private normalizeArabic(text: string): string {
    return text
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/(.)\1+/gu, "$1")
      .toLowerCase();
  }

  /**
   * Folds Arabizi (Arabic written in Latin letters and digits) so spelling
   * variants compare equal: ga7ba / qahba / gahba, kosomak / kusomak,
   * teezak / tizak. Only words made purely of Latin letters and digits are
   * folded; expects text already passed through normalizeArabic.
   */
  private foldArabizi(word: string): string {
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

  /** Normalizes a word or token for comparison. */
  private normalize(text: string): string {
    return this.foldArabizi(this.normalizeArabic(text));
  }

  /**
   * Adds words from one list. A word already present keeps its first source.
   */
  private addEntries(newWords: string[], source: WordSource): void {
    for (const word of newWords) {
      const normalized = this.normalize(word);
      if (!this.words.has(normalized)) this.words.set(normalized, { word, source });
    }
  }

  /**
   * Checks a single word, also trying it with attached prefixes removed
   * (والكحبة -> كحبة, بطيزك -> طيزك), and suffixes removed when stripSuffixes is on.
   * Returns the matched entry, or null.
   * A match cleared by a safe stem is returned with `suppressedBy` set.
   */
  private matchWord(token: string): WordMatch | null {
    const word = this.normalize(token);
    const direct = this.words.get(word);
    if (direct) {
      return { normalized: word, entry: direct.word, source: direct.source, prefix: "", suffix: "" };
    }

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

    const { word: entry, source } = this.words.get(match.stem)!;
    const result: WordMatch = {
      normalized: word, entry, source, prefix: match.prefix, suffix: match.suffix,
    };

    for (const { stem } of candidates) {
      const safe = this.safeStems.find(({ normalized }) => stem.startsWith(normalized));
      if (safe) return { ...result, suppressedBy: safe.word };
    }

    return result;
  }

  /** True when the word is profane, i.e. matched and not cleared by a safe stem. */
  private isProfaneWord(token: string): boolean {
    const match = this.matchWord(token);
    return match !== null && match.suppressedBy === undefined;
  }

  /**
   * Checks if a given text contains profane words.
   */
  public isProfane(text: string): boolean {
    if (!text) return false;

    for (const token of text.match(WORD_PATTERN) ?? []) {
      if (this.isProfaneWord(token)) {
        return true;
      }
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
    // A fresh regex so the shared global pattern's lastIndex is never touched
    const pattern = new RegExp(WORD_PATTERN.source, "g");
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(text))) {
      const token = found[0];
      const match = this.matchWord(token);
      if (match && (match.suppressedBy === undefined || options.includeSuppressed)) {
        matches.push({ token, start: found.index, end: found.index + token.length, ...match });
      }
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
   * Remove words from the active filter dictionary.
   */
  public removeWords(wordsToRemove: string[]): void {
    wordsToRemove.forEach((word) => this.words.delete(this.normalize(word)));
  }
}

export default IraqiBadWordsFilter;
