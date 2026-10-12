# Changelog

## 1.3.0

### Added

- `dialects: ['mosul']` option: every entry and safe stem with ر also matches its غ form (شرموطة → شغموطة). The ر forms keep matching.
- A word with گ is matched both as ق (Iraqi Arabic) and as ك (as Kurdish typists use it): `گحبة` = `قحبة`, `گس` = `كس`. A گ in a list entry means ق.
- `inspect()` matches have a `rules` field naming each rule the word needed to match (`prefix`, `arabizi`, `gaf-as-kaf`, `mosul`, …), so reports show why something matched.
- A safe stem written with گ protects only words spelled with گ. Added گلب (Iraqi spelling of قلب, "heart"), گلاب and طگعة as safe stems.
- بثور ("pimples") is a safe stem, so `includeInsults` no longer flags it as ب + ثور.
- ثورة ("revolution") and ثوري ("revolutionary") are safe stems, so `includeInsults` with `stripSuffixes` no longer flags them as ثور + ة/ي.
- بالعجل ("quickly") is a safe stem, so it isn't flagged as ب + ال + عجل when عجل ("calf") is a custom word.
- `safeWords` option and `addSafeWords()`: your own safe stems, on top of the built-in `safe-stems.json`, for clean words your app sees flagged.
- README: how to keep your own words and safe words in JSON files and use them alongside the built-in lists (`customWords: myWords, safeWords: mySafeWords`).

### Fixed

- A blank entry in `customWords` or `addWords()` (e.g. a stray `""` in a word file) made a lone tatweel or diacritic count as profane. Blank entries are now skipped, and whitespace around entries is trimmed. The same goes for `safeWords`, where a blank entry would have cleared every match.

## 1.2.1

### Fixed

- Invisible characters (zero-width space/joiners, direction marks, soft hyphen, …) hidden inside a word no longer let it through: `عا‌رة` is caught. A bad word next to one is still caught too.
- Letters typed on Persian/Kurdish keyboards now match: ی → ي, ک → ك, ە → ه.
- Arabizi written with Arabic-Indic digits now matches: `ga٧ba` = `ga7ba`.
- Digits glued to or inside an Arabic word no longer hide it: `عارة3`, `عارة٣`, `عا٣رة`. Digits in pure Arabizi words still count as letters (`ga7ba`).
- Arabic-Indic digits and the letters ٮ ٯ were being stripped as if they were diacritics.

## 1.2.0

### Added

- `inspect(text, options?)` lists each bad word with its span in the original text, the normalized form, the list entry it matched, the list it came from (`source`), and any prefix or suffix stripped. `{ includeSuppressed: true }` also returns matches cleared by a safe stem, with `suppressedBy`.
- `stripSuffixes` option (off by default) also matches pronoun-suffix forms the list doesn't spell out (طيزهم → طيز).
- Arabizi spelling variants now match the same entry: `ga7ba` / `qahba` / `gahba`, `kosomak` / `kusumak`, `teezak` / `tizak`, `3ayri` / `ayri`.
- Mosul forms where ر is said as غ (عيغ, عيغك, …), with بعيغ (camel) as a safe stem.
- `test/fixtures/sentences.json`: example sentences with their expected verdicts, each run as a test.

### Changed

- Because of Arabizi folding, Latin words can now match spellings that aren't listed verbatim, e.g. `nik` matches `neek`.

## 1.1.0

### Added

- `src/insults.json` with milder insults (كلب, حمار, قندرة, …), filtered only with `includeInsults: true` because many are everyday words.
- The constructor accepts `{ customWords, includeInsults }`; an array of custom words still works.
- `./package.json` is exposed in `exports`.

### Removed

- فاسد from the main list.

## 1.0.0

- Initial release.
