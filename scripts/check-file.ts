// Runs the filter over a text file and lists every match, to test it on real
// articles or comment threads.
//
//   npm run check -- article.txt [--insults] [--phrases] [--suffixes] [--mosul] [--clean]
//   pbpaste | npm run check -- --phrases      (reads stdin when no file is given)
import { readFileSync } from 'fs';
import { IraqiBadWordsFilter } from '../src/index';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const has = (flag: string) => args.includes(flag);

const filter = new IraqiBadWordsFilter({
  includeInsults: has('--insults'),
  includePhrases: has('--phrases'),
  stripSuffixes: has('--suffixes'),
  dialects: has('--mosul') ? ['mosul'] : [],
});

const text = readFileSync(file ?? 0, 'utf8');
const started = performance.now();
const matches = filter.inspect(text);
const ms = performance.now() - started;

// Line and column of an offset, to find the match in an editor
function position(offset: number): string {
  const lines = text.slice(0, offset).split('\n');
  return `${lines.length}:${lines[lines.length - 1].length + 1}`;
}

for (const match of matches) {
  const details = [match.source, ...match.rules].join(', ');
  const context = text.slice(Math.max(0, match.start - 25), match.end + 25).replace(/\s+/g, ' ');
  console.log(`${position(match.start).padEnd(7)} ${match.token}  →  ${match.entry}  [${details}]`);
  console.log(`        …${context}…`);
}

const words = text.match(/\S+/g)?.length ?? 0;
console.log(`\n${matches.length} matches in ${words} words (${text.length} characters), ${ms.toFixed(1)} ms`);
if (has('--clean')) console.log(`\n${filter.clean(text)}`);
