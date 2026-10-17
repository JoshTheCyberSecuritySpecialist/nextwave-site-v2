import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/contactResponse.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { isContactSubmissionSuccessful } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

for (const [name, ok, data, expected] of [
  ['explicit acknowledgement', true, { success: true }, true],
  ['HTTP failure despite acknowledgement', false, { success: true }, false],
  ['backend rejection', true, { success: false }, false],
  ['empty response', true, null, false],
  ['missing acknowledgement', true, {}, false],
  ['string acknowledgement', true, { success: 'true' }, false],
  ['HTML response', true, '<html>error</html>', false],
]) {
  test(name, () => assert.equal(isContactSubmissionSuccessful(ok, data), expected));
}
