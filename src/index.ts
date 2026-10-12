import badWordsList from './words.json';
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

export class IraqiBadWordsFilter {
  private words: Set<string>;

  // Clean words that would otherwise match after a prefix is stripped
  // (e.g. بعير "camel" = ب + عير). Also covers their prefixed and suffixed
  // forms (وبعيرك). Listed in safe-stems.json.
  private safeStems: string[];

  constructor(customWords: string[] = []) {
    // Combine the external JSON file list with any custom words passed at runtime
    this.words = new Set();
    this.safeStems = safeStemsList.map((stem) => this.normalizeArabic(stem));
    this.addWords([...badWordsList, ...customWords]);
  }

  /**
   * Normalizes Arabic text so spelling variants compare equal:
   * removes diacritics (Tashkeel) and tatweel, unifies Alef/Teh Marbuta/Alef Maksura
   * forms, and collapses stretched letters (عاااارة -> عارة).
   */
  private normalizeArabic(text: string): string {
    return text
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/(.)\1+/gu, "$1")
      .toLowerCase();
  }

  /**
   * Checks a single word, also trying it with attached prefixes removed
   * (والكحبة -> كحبة, بطيزك -> طيزك).
   */
  private isProfaneWord(token: string): boolean {
    const word = this.normalizeArabic(token);
    if (this.words.has(word)) return true;

    const stems = [word];
    for (const conjunction of CONJUNCTIONS) {
      for (const preposition of PREPOSITIONS) {
        for (const article of ARTICLES) {
          const prefix = conjunction + preposition + article;
          if (prefix && word.startsWith(prefix) && word.length - prefix.length >= 2) {
            stems.push(word.slice(prefix.length));
          }
        }
      }
    }

    if (stems.some((stem) => this.safeStems.some((safe) => stem.startsWith(safe)))) {
      return false;
    }

    return stems.some((stem) => this.words.has(stem));
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
   * Replaces profane words with a placeholder string.
   */
  public clean(text: string, placeholder: string = "*"): string {
    if (!text) return "";

    return text.replace(WORD_PATTERN, (token) =>
      this.isProfaneWord(token)
        ? placeholder.repeat(token.length)
        : token
    );
  }

  /**
   * Dynamically add words to the active dictionary.
   */
  public addWords(newWords: string[]): void {
    newWords.forEach((word) => this.words.add(this.normalizeArabic(word)));
  }

  /**
   * Remove words from the active filter dictionary.
   */
  public removeWords(wordsToRemove: string[]): void {
    wordsToRemove.forEach((word) => this.words.delete(this.normalizeArabic(word)));
  }
}

export default IraqiBadWordsFilter;
