# Changelog

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
