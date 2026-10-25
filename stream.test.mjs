import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('./src/services/geminiService.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { fetchProfessorDetailsStream: search } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const profile = { Name: 'Dr. Éxample', Designation: 'Professor', Institute: 'Demo Institute', Email: 'test@example.org', LinkedIn: 'javascript:alert(1)', 'Institute Website': 'https://example.org/faculty' };
const criteria = { institute: ' Demo ', department: '', keyword: '' };
async function run(chunks, status = 200) {
  const previous = globalThis.fetch;
  const found = [], errors = [];
  let payload;
  globalThis.fetch = async (_, options) => {
    payload = JSON.parse(options.body);
    return new Response(new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); } }), { status });
  };
  try { await search(criteria, p => found.push(p), e => errors.push(e.message)); }
  finally { globalThis.fetch = previous; }
  return { found, errors, payload };
}
const bytes = s => new TextEncoder().encode(s);
test('handles arbitrary byte boundaries, final line without newline, duplicates and unsafe links', async () => {
  const data = bytes(JSON.stringify(profile) + '\n' + JSON.stringify(profile));
  const result = await run(Array.from(data, b => Uint8Array.of(b)));
  assert.equal(result.found.length, 1);
  assert.equal(result.found[0].Name, 'Dr. Éxample');
  assert.equal(result.found[0].LinkedIn, null);
  assert.equal(result.payload.institute, 'Demo');
  assert.deepEqual(result.errors, []);
});
test('reports malformed results without discarding valid profiles', async () => {
  const result = await run([bytes(JSON.stringify(profile) + '\nnot json\n')]);
  assert.equal(result.found.length, 1);
  assert.match(result.errors[0], /could not be read/);
});
test('reports an upstream error after a partial result', async () => {
  const result = await run([bytes(JSON.stringify(profile) + '\n' + JSON.stringify({error: 'Search interrupted'}) + '\n')]);
  assert.equal(result.found.length, 1);
  assert.deepEqual(result.errors, ['Search interrupted']);
});
test('distinguishes a failed HTTP request from no matches', async () => {
  const result = await run([bytes(JSON.stringify({error: 'Service unavailable'}))], 503);
  assert.deepEqual(result.found, []);
  assert.deepEqual(result.errors, ['Service unavailable']);
});
test('rejects whitespace-only search criteria', async () => {
  await assert.rejects(search({institute: ' ', department: '\t', keyword: ''}, () => {}, () => {}), /provide an institute/);
});
test('rejects an unbounded unfinished upstream record', async () => {
  const result = await run([bytes('x'.repeat(1_000_001))]);
  assert.match(result.errors[0], /too large/);
});
