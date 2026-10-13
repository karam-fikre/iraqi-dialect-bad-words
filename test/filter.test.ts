import { IraqiBadWordsFilter } from '../src/index';
import assert from 'assert';

describe('IraqiBadWordsFilter Unit Tests', () => {
  const filter = new IraqiBadWordsFilter();

  it('should detect Iraqi profanity correctly', () => {
    assert.strictEqual(filter.isProfane('هذا كلام عارة'), true);
  });

  it('should ignore clean text', () => {
    assert.strictEqual(filter.isProfane('مرحبا بك'), false);
  });

  it('should clean text with custom placeholders', () => {
    const result = filter.clean('هذا كلام عارة', '#');
    assert.strictEqual(result, 'هذا كلام ####');
  });

  it('should clean text with empty placeholders', () => {
  const result = filter.clean('هذا كلام عارة', '');
  assert.strictEqual(result, 'هذا كلام ');
  });

  it('should match words written with diacritics', () => {
    assert.strictEqual(filter.isProfane('عَارَة'), true);
    assert.strictEqual(filter.clean('عَارَة'), '******');
  });

  it('should match stretched letters and tatweel', () => {
    assert.strictEqual(filter.isProfane('عاااارة'), true);
    assert.strictEqual(filter.isProfane('عـــارة'), true);
  });

  it('should match Teh Marbuta written as Heh', () => {
    assert.strictEqual(filter.isProfane('عاره'), true);
  });

  it('should match words next to punctuation and keep the punctuation', () => {
    assert.strictEqual(filter.isProfane('عارة!'), true);
    assert.strictEqual(filter.clean('انت عارة، صدك؟'), 'انت ****، صدك؟');
  });

  it('should not mask part of a longer clean word', () => {
    const custom = new IraqiBadWordsFilter(['كلب']);
    assert.strictEqual(custom.isProfane('كلبين'), false);
    assert.strictEqual(custom.clean('كلبين'), 'كلبين');
  });

  it('should match words with attached prefixes', () => {
    assert.strictEqual(filter.isProfane('والكحبة'), true);
    assert.strictEqual(filter.isProfane('بطيزك'), true);
    assert.strictEqual(filter.isProfane('للكواد'), true);
    assert.strictEqual(filter.isProfane('فالمطي'), true);
    assert.strictEqual(filter.clean('روح للكواد'), 'روح ******');
  });

  it('should not flag clean words that only look like prefix + bad word', () => {
    assert.strictEqual(filter.isProfane('شفت بعير بالبر'), false);
    assert.strictEqual(filter.isProfane('البعير'), false);
    assert.strictEqual(filter.isProfane('وبعيرك'), false);
  });

  it('should not filter insults by default', () => {
    assert.strictEqual(filter.isProfane('عندي كلب بالبيت'), false);
    assert.strictEqual(filter.isProfane('جلب لي هدية'), false);
  });

  it('should filter insults when includeInsults is on', () => {
    const strict = new IraqiBadWordsFilter({ includeInsults: true });
    assert.strictEqual(strict.isProfane('انت حمار'), true);
    assert.strictEqual(strict.clean('ابن الكلب'), 'ابن *****');
    assert.strictEqual(strict.isProfane('هذا كلام عارة'), true);
  });

  it('should accept custom words as an array or in options', () => {
    assert.strictEqual(new IraqiBadWordsFilter(['زفت']).isProfane('زفت'), true);
    assert.strictEqual(new IraqiBadWordsFilter({ customWords: ['زفت'] }).isProfane('زفت'), true);
  });

  it('should use a word file alongside the built-in list', () => {
    // As loaded from a hand-edited my-words.json
    const myWords: string[] = JSON.parse('["زفت", " نذل ", "", "   ", "ـــ"]');
    const custom = new IraqiBadWordsFilter({ customWords: myWords });

    assert.strictEqual(custom.isProfane('هذا كلام عارة'), true);
    assert.strictEqual(custom.isProfane('انت زفت'), true);
    assert.strictEqual(custom.isProfane('انت نذل'), true);
    assert.strictEqual(custom.inspect('انت نذل')[0].entry, 'نذل');
    // Blank entries must not turn a lone tatweel into a match
    assert.strictEqual(custom.isProfane('مرحبا ـــ'), false);
    custom.addWords(['']);
    assert.strictEqual(custom.isProfane('ـ'), false);
  });

  it('should use safe words alongside the built-in safe stems', () => {
    // A made-up pair: بزفت = ب + the custom word زفت
    assert.strictEqual(new IraqiBadWordsFilter({ customWords: ['زفت'] }).isProfane('هذا بزفت'), true);

    const mySafeWords: string[] = JSON.parse('[" بزفت ", "", "   "]');
    const custom = new IraqiBadWordsFilter({ customWords: ['زفت'], safeWords: mySafeWords });
    assert.strictEqual(custom.isProfane('هذا بزفت'), false);
    assert.strictEqual(custom.isProfane('وبزفتك'), false);
    assert.strictEqual(custom.inspect('بزفت', { includeSuppressed: true })[0].suppressedBy, 'بزفت');
    // Built-in safe stems still apply, and blank entries don't clear every match
    assert.strictEqual(custom.isProfane('شفت بعير'), false);
    assert.strictEqual(custom.isProfane('انت زفت'), true);
    assert.strictEqual(custom.isProfane('هذا كلام عارة'), true);
  });

  it('should add safe words later and give them Mosul forms', () => {
    const custom = new IraqiBadWordsFilter({ customWords: ['زرق'], dialects: ['mosul'] });
    assert.strictEqual(custom.isProfane('بزغق'), true);
    custom.addSafeWords(['بزرق']);
    assert.strictEqual(custom.isProfane('بزرق'), false);
    assert.strictEqual(custom.isProfane('بزغق'), false);
    custom.addSafeWords(['']);
    assert.strictEqual(custom.isProfane('زرق'), true);
  });

  it('should add and remove words regardless of diacritics', () => {
    const custom = new IraqiBadWordsFilter();
    custom.addWords(['زَفت']);
    assert.strictEqual(custom.isProfane('زفت'), true);
    custom.removeWords(['زفت']);
    assert.strictEqual(custom.isProfane('زفت'), false);
  });

  it('should inspect matches with spans in the original text', () => {
    const text = 'انت عَارَة، روح للكواد!';
    const matches = filter.inspect(text);
    assert.strictEqual(matches.length, 2);

    assert.deepStrictEqual(matches[0], {
      token: 'عَارَة', start: 4, end: 10, normalized: 'عاره', entry: 'عارة', source: 'words', prefix: '', suffix: '',
      rules: ['diacritics'],
    });
    assert.strictEqual(matches[1].token, 'للكواد');
    assert.strictEqual(matches[1].normalized, 'لكواد');
    assert.strictEqual(matches[1].entry, 'كواد');
    assert.strictEqual(matches[1].prefix, 'ل');

    for (const m of matches) assert.strictEqual(text.slice(m.start, m.end), m.token);
  });

  it('should inspect clean and safe-stem text as no matches', () => {
    assert.deepStrictEqual(filter.inspect(''), []);
    assert.deepStrictEqual(filter.inspect('شفت بعير بالبر'), []);
  });

  it('should agree with isProfane and not disturb it', () => {
    filter.inspect('عارة عارة');
    assert.strictEqual(filter.isProfane('عارة'), true);
    assert.strictEqual(filter.clean('عارة عارة'), '**** ****');
  });

  it('should report which list a match came from', () => {
    const strict = new IraqiBadWordsFilter({ includeInsults: true, customWords: ['زفت'] });
    const sources = strict.inspect('عارة حمار زفت').map((m) => m.source);
    assert.deepStrictEqual(sources, ['words', 'insults', 'custom']);

    strict.addWords(['darn']);
    assert.strictEqual(strict.inspect('darn')[0].source, 'custom');
  });

  it('should report safe-stem matches only when asked', () => {
    assert.deepStrictEqual(filter.inspect('وبعيرك'), []);

    const [match] = filter.inspect('شفت وبعيرك', { includeSuppressed: true });
    assert.strictEqual(match.token, 'وبعيرك');
    assert.strictEqual(match.suppressedBy, 'بعير');
    assert.strictEqual(match.prefix, 'وب');
    assert.strictEqual(match.entry, 'عيرك');
    assert.strictEqual(filter.isProfane('وبعيرك'), false);
  });

  it('should leave suppressedBy unset on real matches', () => {
    const [match] = filter.inspect('بطيزك', { includeSuppressed: true });
    assert.strictEqual(match.suppressedBy, undefined);
  });

  it('should not strip suffixes by default', () => {
    const custom = new IraqiBadWordsFilter(['زفت']);
    assert.strictEqual(custom.isProfane('زفتهم'), false);
  });

  it('should strip pronoun suffixes when stripSuffixes is on', () => {
    const custom = new IraqiBadWordsFilter({ customWords: ['زفت'], stripSuffixes: true });
    for (const word of ['زفتي', 'زفتك', 'زفتج', 'زفته', 'زفتها', 'زفتنا', 'زفتكم', 'زفتهم']) {
      assert.strictEqual(custom.isProfane(word), true, word);
    }
    assert.strictEqual(custom.clean('هذا وزفتهم'), 'هذا ******');

    const [match] = custom.inspect('وزفتهم');
    assert.strictEqual(match.prefix, 'و');
    assert.strictEqual(match.suffix, 'هم');
    assert.strictEqual(match.entry, 'زفت');
  });

  it('should still only match whole stems with stripSuffixes', () => {
    const custom = new IraqiBadWordsFilter({ customWords: ['زفت'], stripSuffixes: true });
    assert.strictEqual(custom.isProfane('زفتين'), false);
    assert.strictEqual(custom.isProfane('مزفته'), false);
  });

  it('should keep safe stems safe with stripSuffixes', () => {
    const loose = new IraqiBadWordsFilter({ stripSuffixes: true });
    assert.strictEqual(loose.isProfane('وبعيرهم'), false);
    assert.strictEqual(loose.isProfane('شفت بعير بالبر'), false);
  });

  it('should prefer the match with the least stripping', () => {
    const loose = new IraqiBadWordsFilter({ stripSuffixes: true });
    const [match] = loose.inspect('طيزك');
    assert.strictEqual(match.entry, 'طيزك');
    assert.strictEqual(match.suffix, '');
  });

  it('should match Arabizi spelling variants of listed words', () => {
    // Only "kosomak", "teezak", "gahba", "sharmouta" and "3ayri" spellings matter here
    for (const word of ['kusumak', 'KOSOMAK', 'tezak', 'Qa7ba', 'sharmuta', 'ayri', '3aayri']) {
      assert.strictEqual(filter.isProfane(word), true, word);
    }
  });

  it('should not fold Arabizi in Arabic, mixed or number-only words', () => {
    const custom = new IraqiBadWordsFilter(['h']);
    assert.strictEqual(custom.isProfane('7'), false);
    assert.strictEqual(filter.isProfane('hello world 2024'), false);
    assert.strictEqual(filter.clean('ok 37 ga7ba!'), 'ok 37 *****!');
  });

  it('should report the folded form in inspect', () => {
    const [match] = filter.inspect('Qa7ba');
    assert.strictEqual(match.token, 'Qa7ba');
    assert.strictEqual(match.normalized, 'gahba');
    assert.strictEqual(match.entry, 'gahba');
  });

  it('should clean several matches and keep the text between them', () => {
    assert.strictEqual(filter.clean('عارة و عارة.', '#'), '#### و ####.');
    assert.strictEqual(filter.clean('مرحبا', '#'), 'مرحبا');
  });

  it('should match words with invisible characters hidden inside', () => {
    for (const char of ['\u200c', '\u200d', '\u200b', '\u200f', '\u061c', '\u00ad', '\ufeff', '\u2066']) {
      const text = `انت عا${char}رة`;
      assert.strictEqual(filter.isProfane(text), true, JSON.stringify(char));
      assert.strictEqual(filter.clean(text), 'انت *****');
    }
  });

  it('should still match a bad word next to an invisible character', () => {
    const text = 'عارة\u200bمرحبا';
    const [match] = filter.inspect(text);
    assert.strictEqual(match.token, 'عارة');
    assert.strictEqual(text.slice(match.start, match.end), 'عارة');
    assert.strictEqual(filter.clean(text), '****\u200bمرحبا');
  });

  it('should keep spans exact around invisible characters', () => {
    const text = 'هلا، بطي\u200cزك!';
    const [match] = filter.inspect(text);
    assert.strictEqual(text.slice(match.start, match.end), match.token);
    assert.strictEqual(match.token, 'بطي\u200cزك');
    assert.strictEqual(match.entry, 'طيزك');
  });

  it('should not flag clean text with invisible characters', () => {
    assert.strictEqual(filter.isProfane('مر\u200cحبا بك'), false);
    assert.strictEqual(filter.isProfane('\u200b\u200c'), false);
  });

  it('should match Persian and Kurdish keyboard letters', () => {
    assert.strictEqual(filter.isProfane('عیر'), true);   // Persian ی
    assert.strictEqual(filter.isProfane('کس'), true);    // Persian ک
    assert.strictEqual(filter.isProfane('عارە'), true);  // Kurdish ە
    assert.strictEqual(filter.inspect('بعیر').length, 0); // safe stem still applies
  });

  it('should match Arabizi written with Arabic-Indic digits', () => {
    assert.strictEqual(filter.isProfane('ga٧ba'), true);
    assert.strictEqual(filter.isProfane('٣ayri'), true);
    assert.strictEqual(filter.isProfane('ga۷ba'), true);  // Persian digit
    assert.strictEqual(filter.isProfane('٧٣'), false);
  });

  it('should match Arabic words with digits glued on or inside', () => {
    for (const word of ['عارة3', 'عارة٣', '3عارة', 'عا٣رة', 'عا33ارة']) {
      assert.strictEqual(filter.isProfane(word), true, word);
    }
    assert.strictEqual(filter.clean('انت عارة٣٣'), 'انت ******');
    assert.strictEqual(filter.isProfane('مرحبا2024'), false);
    assert.strictEqual(filter.isProfane('ga7ba'), true);
  });

  it('should read گ as ق', () => {
    assert.strictEqual(filter.isProfane('گحبة'), true);
    assert.strictEqual(filter.isProfane('والگواد'), true);
    assert.strictEqual(filter.inspect('گحبة')[0].normalized, 'قحبه');
  });

  it('should also read گ as ك, as Kurdish typists use it', () => {
    const [match] = filter.inspect('گسك');
    assert.strictEqual(match.normalized, 'كسك');
    assert.strictEqual(match.entry, 'كسك');
    assert.strictEqual(filter.isProfane('گسها'), true);
  });

  it('should treat گ in a list entry as ق', () => {
    const custom = new IraqiBadWordsFilter(['گفت']);
    assert.strictEqual(custom.isProfane('قفت'), true);
    assert.strictEqual(custom.isProfane('گفت'), true);
  });

  it('should not add Mosul forms by default', () => {
    assert.strictEqual(filter.isProfane('شغموطة'), false);
  });

  it('should match Mosul ر → غ forms with dialects: ["mosul"]', () => {
    const mosul = new IraqiBadWordsFilter({ dialects: ['mosul'] });
    assert.strictEqual(mosul.isProfane('شغموطة'), true);
    assert.strictEqual(mosul.isProfane('شرموطة'), true);   // ر forms still match
    assert.strictEqual(mosul.isProfane('سغسغي'), true);    // every ر in the word
    const [match] = mosul.inspect('الشغموطة');
    assert.strictEqual(match.entry, 'الشرموطة');
    assert.strictEqual(match.source, 'words');
    assert.deepStrictEqual(match.rules, ['mosul']);
    assert.deepStrictEqual(mosul.inspect('عيغ')[0].rules, []);  // listed in its own right
  });

  it('should apply Mosul forms to custom words and safe stems', () => {
    const mosul = new IraqiBadWordsFilter({ dialects: ['mosul'], customWords: ['زرق'] });
    assert.strictEqual(mosul.isProfane('زغق'), true);
    mosul.addWords(['برك']);
    assert.strictEqual(mosul.isProfane('بغك'), true);
    assert.strictEqual(mosul.isProfane('شفت بعيغ'), false);
  });

  it('should remove the Mosul form along with the word', () => {
    const mosul = new IraqiBadWordsFilter({ dialects: ['mosul'] });
    mosul.removeWords(['شرموطة']);
    assert.strictEqual(mosul.isProfane('شرموطة'), false);
    assert.strictEqual(mosul.isProfane('شغموطة'), false);
  });

  it('should keep گلب (Iraqi spelling of قلب "heart") clean', () => {
    const strict = new IraqiBadWordsFilter({ includeInsults: true, stripSuffixes: true });
    for (const word of ['گلب', 'گلبي', 'بگلبي', 'والگلب']) {
      assert.strictEqual(strict.isProfane(word), false, word);
    }
    assert.strictEqual(strict.isProfane('كلب'), true);
    assert.strictEqual(strict.isProfane('ابن الكلب'), true);

    const [match] = strict.inspect('گلب', { includeSuppressed: true });
    assert.strictEqual(match.entry, 'كلب');
    assert.strictEqual(match.suppressedBy, 'گلب');
  });

  it('should flag گس, as Kurdish typists write كس', () => {
    for (const word of ['گس', 'الگس', 'والگس', 'گسها', 'گسگ']) {
      assert.strictEqual(filter.isProfane(word), true, word);
    }
    assert.strictEqual(filter.isProfane('قس'), false);   // priest, written with ق
    assert.strictEqual(filter.isProfane('القس'), false);
  });

  it('should keep گلاب and طگعة clean', () => {
    const strict = new IraqiBadWordsFilter({ includeInsults: true, stripSuffixes: true });
    assert.strictEqual(strict.isProfane('گلاب'), false);
    assert.strictEqual(strict.isProfane('طگعة'), false);
    assert.strictEqual(strict.isProfane('كلاب'), true);
  });

  it('should report which rules a match needed', () => {
    const rules = (text: string, f = filter) => f.inspect(text, { includeSuppressed: true })[0].rules;
    assert.deepStrictEqual(rules('عارة'), []);
    assert.deepStrictEqual(rules('عاره'), ['spelling']);
    assert.deepStrictEqual(rules('عاااارة'), ['stretched']);
    assert.deepStrictEqual(rules('عا\u200cرة'), ['invisible']);
    assert.deepStrictEqual(rules('کس'), ['keyboard']);
    assert.deepStrictEqual(rules('ga٧ba'), ['arabic-digits', 'arabizi']);
    assert.deepStrictEqual(rules('kosomak'), []);
    assert.deepStrictEqual(rules('kusumak'), ['arabizi']);
    assert.deepStrictEqual(rules('عارة3'), ['glued-digits']);
    assert.deepStrictEqual(rules('بطيزك'), ['prefix']);
    assert.deepStrictEqual(rules('گحبة'), ['gaf-as-qaf']);
    assert.deepStrictEqual(rules('گسها'), ['gaf-as-kaf']);
    assert.deepStrictEqual(rules('طيزهم', new IraqiBadWordsFilter({ stripSuffixes: true })), ['suffix']);
    assert.deepStrictEqual(rules('سغسغي', new IraqiBadWordsFilter({ dialects: ['mosul'] })), ['mosul']);
    assert.deepStrictEqual(rules('وبعيرك'), ['prefix']);  // suppressed matches carry rules too
    assert.deepStrictEqual(rules('ﻋﻴﺮ'), ['unicode-forms']);
    assert.deepStrictEqual(rules('ع*ي*ر'), ['split']);
    assert.deepStrictEqual(rules('وال*عير'), ['prefix', 'split']);
    assert.deepStrictEqual(rules('g@hba'), ['symbols']);
    assert.deepStrictEqual(rules('$harmoota'), ['symbols', 'arabizi']);
  });

  it('should match words split by symbols or spaces', () => {
    const split = [
      'ع*ي*ر', 'ع.ي.ر', 'ع-ي-ر', 'ع_ي_ر', 'ع🔥ي🔥ر', 'ع،ي،ر', 'ع/ي/ر', 'ع ي ر', 'ع  *  ي  *  ر',
      'عي*ر', 'عي * ر', 'قح.بة', 'شرم*وطة', 'ك ح ب ة', 'عـ ي ـر', 'g-a-h-b-a', 'g a h b a', 'g\u0336a\u0336h\u0336b\u0336a',
    ];
    for (const text of split) assert.strictEqual(filter.isProfane(text), true, text);
  });

  it('should mask a split word whole, separators included', () => {
    assert.strictEqual(filter.clean('انت ع*ي*ر!'), 'انت *****!');
    const [match] = filter.inspect('انت ع ي ر');
    assert.strictEqual(match.token, 'ع ي ر');
    assert.strictEqual(match.start, 4);
    assert.strictEqual(match.end, 9);
    assert.strictEqual(match.entry, 'عير');
    assert.strictEqual(filter.inspect('ع*ي*ر عارة').length, 2);
  });

  it('should strip prefixes and suffixes from split words', () => {
    assert.strictEqual(filter.isProfane('و ع ي ر'), true);
    assert.strictEqual(filter.isProfane('ع ي ر ك'), true);
    assert.deepStrictEqual(filter.inspect('وال*عير')[0].rules, ['prefix', 'split']);
  });

  it('should not join normal words into a bad word', () => {
    const clean = [
      'انا و انت', 'د. علي راح للبيت', 'ص.ب 123', 'و/أو', 'الساعة 10:30', 'مرحبا،كيفك؟', 'يا - من',
      'a b c d e f', 'http://www.example.com/a-b-c', '#hashtag_one_two', 'عمر',
      'عي ر',        // spaces only, between pieces longer than one letter
      'شرم * وطة',   // pieces longer than two letters around a spaced gap
      'ع\nي\nر',     // line breaks always separate words
      'ع      ي',    // gap too long
    ];
    for (const text of clean) assert.strictEqual(filter.isProfane(text), false, text);
  });

  it('should keep safe stems safe when split, but not hide a bad word beside one', () => {
    assert.strictEqual(filter.isProfane('ب ع ي ر'), false);
    assert.strictEqual(filter.inspect('ب ع ي ر', { includeSuppressed: true })[0].suppressedBy, 'بعير');
    assert.strictEqual(filter.isProfane('ب*عير'), true);  // عير stands as a word of its own
  });

  it('should read presentation forms and full-width letters as plain letters', () => {
    assert.strictEqual(filter.isProfane('ﻋﻴﺮ'), true);
    assert.strictEqual(filter.isProfane('ｇａｈｂａ'), true);
    assert.strictEqual(filter.clean('انت ﻋﺎﺭﺓ'), 'انت ****');
  });

  it('should match words with the vocative يا glued on', () => {
    assert.strictEqual(filter.isProfane('ياعارة'), true);
    assert.strictEqual(filter.isProfane('يالعارة'), true);
    assert.strictEqual(filter.isProfane('ياالعارة'), true);
    assert.strictEqual(filter.inspect('ياعارة')[0].prefix, 'يا');
    assert.strictEqual(new IraqiBadWordsFilter({ includeInsults: true }).isProfane('ياكلب'), true);
    assert.strictEqual(filter.isProfane('وياعارة'), true);  // Iraqi ويا, "with"
    assert.strictEqual(filter.isProfane('ويالعارة'), true);
    assert.strictEqual(filter.inspect('وياعارة')[0].prefix, 'ويا');
    for (const text of [
      'يابس', 'ياكل', 'ياكلها', 'ياسمين', 'يارب', 'ياريت', 'يالله', 'ياخي',
      'وياك', 'وياكم', 'ويانا', 'وياه', 'وياها', 'وياهم', 'ويايا', 'ويابس',
    ]) {
      assert.strictEqual(filter.isProfane(text), false, text);
    }
  });

  it('should read Arabizi 6 as ط and 8, 9 as ق', () => {
    assert.strictEqual(filter.isProfane('6eezak'), true);
    assert.strictEqual(filter.isProfane('9awad'), true);
    assert.strictEqual(filter.isProfane('gawad'), true);
    assert.strictEqual(filter.isProfane('8a7ba'), true);
    assert.deepStrictEqual(filter.inspect('6eezak')[0].rules, ['arabizi']);
    assert.strictEqual(filter.isProfane('sawad 2016 9:30'), false);
  });

  it('should read Greek and Cyrillic look-alikes in Latin words', () => {
    assert.strictEqual(filter.isProfane('g\u0430hba'), true);   // Cyrillic а
    assert.strictEqual(filter.isProfane('GAH\u0392A'), true);   // Greek Β
    assert.deepStrictEqual(filter.inspect('g\u0430hba')[0].rules, ['lookalike']);
    assert.strictEqual(filter.isProfane('привет как дела'), false);  // Russian text is left alone
  });

  it('should read mathematical letters and mask one placeholder per character', () => {
    assert.strictEqual(filter.isProfane('𝐠𝐚𝐡𝐛𝐚'), true);
    assert.strictEqual(filter.isProfane('𝒈𝒂𝒉𝒃𝒂'), true);
    assert.strictEqual(filter.clean('انت 𝐠𝐚𝐡𝐛𝐚!'), 'انت *****!');
    assert.strictEqual(filter.clean('ع🔥ي🔥ر'), '*****');
  });

  it('should not filter phrases by default', () => {
    assert.strictEqual(filter.isProfane('تعال العب بيه'), false);
  });

  it('should filter phrases when includePhrases is on', () => {
    const phrases = new IraqiBadWordsFilter({ includePhrases: true });
    assert.strictEqual(phrases.isProfane('تعال العب بيه'), true);
    assert.strictEqual(phrases.isProfane('تعال العب بينو'), true);
    assert.strictEqual(phrases.clean('تعال العب بيه يا حلو'), '************* يا حلو');

    const [match] = phrases.inspect('هسه تعال العب بيه');
    assert.strictEqual(match.token, 'تعال العب بيه');
    assert.strictEqual(match.start, 4);
    assert.strictEqual(match.entry, 'تعال العب|العبلي بيه|بينو');
    assert.strictEqual(match.source, 'phrases');
    assert.deepStrictEqual(match.rules, ['phrase']);
  });

  it('should match phrases with normalized words, punctuation and a prefix', () => {
    const phrases = new IraqiBadWordsFilter({ includePhrases: true });
    assert.strictEqual(phrases.isProfane('تعااال إلعب بيه'), true);
    assert.strictEqual(phrases.isProfane('تعال،  العب بيه!'), true);
    const [match] = phrases.inspect('وتعال العب بيه');
    assert.strictEqual(match.prefix, 'و');
    assert.deepStrictEqual(match.rules, ['prefix', 'phrase']);
  });

  it('should match any alternative of each phrase word', () => {
    const custom = new IraqiBadWordsFilter({ customPhrases: ['روح|امشي يمه|يمي'] });
    for (const text of ['روح يمه', 'روح يمي', 'امشي يمه', 'امشي يمي']) {
      assert.strictEqual(custom.isProfane(text), true, text);
    }
    assert.strictEqual(custom.isProfane('روح امشي'), false);
    assert.strictEqual(custom.inspect('امشي يمي')[0].entry, 'روح|امشي يمه|يمي');
  });

  it('should match the progressive د on the first word of a phrase', () => {
    const phrases = new IraqiBadWordsFilter({ includePhrases: true });
    assert.strictEqual(phrases.isProfane('دقوم بيه'), true);
    assert.strictEqual(phrases.isProfane('دگوم بينو'), true);
    const [match] = phrases.inspect('ودقوم بيه');
    assert.strictEqual(match.prefix, 'ود');
    assert.deepStrictEqual(match.rules, ['prefix', 'phrase']);
  });

  it('should only match whole phrases', () => {
    const phrases = new IraqiBadWordsFilter({ includePhrases: true });
    for (const text of ['تعال العب', 'العب بيه', 'تعال هنا العب بيه', 'تعال العب بيهم', 'قوم بينا نروح', 'دروح بيه']) {
      assert.strictEqual(phrases.isProfane(text), false, text);
    }
  });

  it('should add, remove and give Mosul forms to custom phrases', () => {
    const custom = new IraqiBadWordsFilter({ customPhrases: ['روح برا'], dialects: ['mosul'] });
    assert.strictEqual(custom.isProfane('روح برا'), true);
    assert.strictEqual(custom.isProfane('غوح بغا'), true);
    assert.strictEqual(custom.inspect('روح برا')[0].source, 'custom');

    custom.addPhrases(['تعال العب بيه|بينو']);
    assert.strictEqual(custom.isProfane('تعال العب بينو'), true);
    custom.removePhrases(['روح برا', 'تعال العب بينو|بيه']);  // alternatives in any order
    assert.strictEqual(custom.isProfane('روح برا'), false);
    assert.strictEqual(custom.isProfane('غوح بغا'), false);
    assert.strictEqual(custom.isProfane('تعال العب بيه'), false);

    const builtIn = new IraqiBadWordsFilter({ includePhrases: true });
    builtIn.removePhrases(['قوم|كوم بيه|بينو']);
    assert.strictEqual(builtIn.isProfane('قوم بيه'), false);
    assert.strictEqual(builtIn.isProfane('قومي بيه'), true);
  });

  it('should read @ and $ as letters in Arabizi words', () => {
    assert.strictEqual(filter.isProfane('g@hba'), true);
    assert.strictEqual(filter.isProfane('$harmoota'), true);
    assert.strictEqual(filter.clean('you g@hba!'), 'you *****!');
    assert.strictEqual(filter.isProfane('ayri@hotmail.com'), true);  // the word before @ still counts
    assert.strictEqual(filter.isProfane('me@site.com, price $100'), false);
  });
});
