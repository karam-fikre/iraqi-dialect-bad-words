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

  it('should add and remove words regardless of diacritics', () => {
    const custom = new IraqiBadWordsFilter();
    custom.addWords(['زَفت']);
    assert.strictEqual(custom.isProfane('زفت'), true);
    custom.removeWords(['زفت']);
    assert.strictEqual(custom.isProfane('زفت'), false);
  });
});
