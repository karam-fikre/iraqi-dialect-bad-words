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
});
