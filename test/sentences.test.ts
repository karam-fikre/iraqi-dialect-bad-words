import { IraqiBadWordsFilter, IraqiBadWordsFilterOptions } from '../src/index';
import assert from 'assert';
import sentences from './fixtures/sentences.json';

// Each sentence's expected verdict is a native-speaker judgment.
// A word-list or matching change that flips one of them fails here.
interface Sentence {
  text: string;
  profane: boolean;
  options?: IraqiBadWordsFilterOptions;
  note?: string;
}

describe('Reviewed sentences', () => {
  for (const { text, profane, options, note } of sentences as Sentence[]) {
    const flags = options ? ` ${JSON.stringify(options)}` : '';
    const label = `${profane ? 'flags' : 'allows'} "${text}"${flags}${note ? ` (${note})` : ''}`;

    it(label, () => {
      const filter = new IraqiBadWordsFilter(options);
      assert.strictEqual(filter.isProfane(text), profane, JSON.stringify(filter.inspect(text)));
    });
  }
});
