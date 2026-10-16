# Changelog

## Unreleased

### Added

- چ is read as ك, as Iraqi says ك in many words: `چلب` = `كلب` (rule `che-as-kaf`). پ and ڤ are read as ب and ف: `پورنو` = `بورنو` (rule `keyboard`).
- A list entry typed several times with no space is caught: `عيرعير`, `gahbagahba`, `والعيروالعير` (rule `repeated`). Only exact repeats count, so a clean word that contains a bad word still isn't flagged.
- New words: كسج, كسمج, كسامج, كسختج, كسخواتك, عيرج, طيزج, زبج, ايري, ايرك, ايرج, انيج, ينيك, تنيك, نياج, طياز, شرمطة, قوادة, كوادة, كوادين, نغول, مومس, مومسات, داعرة, `kos`, `kosokhtak`, `kos5tak`, `zeb`, `khara`, `3ahra`, `zmal`, `aneekak`.
- New insults (with `includeInsults`): كلبة, زبالة, حقير, حقيرة, بغل, جحش, خنزير, خنازير, قرد, حثالة, نجس, واطي, منحط, ساقطة, فرخ, مخبل, `zbala`, `khanzeer`, `7aqeer`.
- New phrases (with `includePhrases`): `انعل ابوك`, `يلعن ابوك` and their forms, `ابن الحرام` / `ابن الزنا` and their forms.
- New safe stems: كسكس (couscous, which was flagged as ك + سكس), عرصة (plot of land), زمالة (fellowship), زمالك, خولة, مطية, نغلي ("we boil"), and واير / باير so the new ايري doesn't flag "my wire" or unsold goods.
- Tests that check the word lists themselves (no duplicates after normalization, no entries the filter already catches, no safe stems that clear nothing), and a clean-text fixture that must never be flagged.

### Changed

- Entries that were duplicates after normalization (`گحبة` = `قحبة`, `qahba` = `gahba`, …) or already caught through a prefix (`الكس`, `الشرموطة`, `الكلب`, …) were removed from the lists. Nothing that was flagged before stops being flagged, but `inspect()` now reports such a word as the shorter entry with its prefix: `الشرموطة` is `entry: 'شرموطة', prefix: 'ال'`.
- `MatchRule` has new members `che-as-kaf` and `repeated`. TypeScript code with an exhaustive `switch` over it needs the new cases.
- Regular expressions no longer use the `u` flag, in line with the rest of the code's support for older Hermes (React Native). Matching is unchanged.

## 1.4.0

### Added

- Words split into pieces by symbols or spaces are caught: `ع*ي*ر`, `ع.ي.ر`, `ع-ي-ر`, `ع ي ر`, `عي * ر`, `شرم.وطة`, `g-a-h-b-a`. The whole split word, separators included, is reported and masked. Normal sentences (`انا و انت`, `د. علي`) aren't joined. `inspect()` reports the rule `split`.
- Arabic presentation forms and full-width letters are read as plain letters: `ﻋﻴﺮ` = `عير`, `ｇａｈｂａ` = `gahba` (rule `unicode-forms`).
- `@` and `$` standing in for a and s in Arabizi words are read as letters: `g@hba`, `$harmoota` (rule `symbols`).
- The vocative يا glued to a word is stripped like other prefixes: `ياعارة`, `يالعارة`, and with و, also Iraqi ويا ("with"): `وياعارة`.
- Arabizi `6` is read as ط (t) and `8`, `9` as ق (g): `6eezak` = `teezak`, `9awad` = `gawad`.
- Greek and Cyrillic letters that look like Latin ones are read as Latin in a word that also has Latin letters: `gаhba` with a Cyrillic `а` (rule `lookalike`). Words written only in Greek or Cyrillic are left alone.
- Mathematical letters (`𝐠𝐚𝐡𝐛𝐚`, `𝒈𝒂𝒉𝒃𝒂`) are read as plain letters (rule `unicode-forms`).
- New words: `teez` (Arabizi طيز, so `tiz` and `6eez` match too), لقلقو, خصوة (also خصوه), خصاوي.
- Phrases: `src/phrases.json` lists phrases of clean words that are vulgar together (`تعال العب بيه`, `تعال العب بينو`), filtered only with `includePhrases: true`, since the words can be meant literally. Your own phrases go in `customPhrases` or `addPhrases()`, and `removePhrases()` drops any. A phrase is matched word by word after normalization, punctuation between words is ignored, and the first word can carry a prefix (`وتعال، العب بيه`). The whole phrase is one match with `source: 'phrases'` and the rule `phrase`.
- A phrase word can list alternatives separated by `|`: `قوم|كوم بيه|بينو` matches all four combinations. `phrases.json` uses this, so it no longer lists every combination (or گ spellings, which match the ق alternative anyway).
- The first word of a phrase can carry the Iraqi progressive `د`: `دقوم بيه`.

- `npm run check -- file.txt` (development only, not published) lists every match in a text file with its position, entry, rules and context, to test the filter on real articles.

### Changed

- `MatchRule` has new members (`unicode-forms`, `lookalike`, `split`, `symbols`, `phrase`) and `WordSource` has `'phrases'`. TypeScript code with an exhaustive `switch` over either needs the new cases.
- `_` now separates words like other symbols, so `ع_ي_ر` is caught as a split word.
- `clean()` puts one placeholder per character, so an emoji or a mathematical letter inside a masked word gets one `*`, not two.
- Normalized words are cached per filter, so checking text is faster than before, even with the new passes.

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
