// Run: node tests/workstation.mjs. No browser or model keys required.
import assert from 'node:assert/strict';
import { readEvents, applyEvent, safeUrl } from '../web/chat.mjs';

const turn = () => ({ blocks: [], tokens: 0, finished: false });
const a = turn(), b = turn();
const frames = [
  ['tool_use_start', { name: 'search_kb' }],
  ['tool_use_start', { name: 'search_kb' }],
  ['tool_result', { name: 'search_kb', is_error: false, source_items: [{ label: 'Hours' }] }],
  ['tool_result', { name: 'search_kb', is_error: true }],
  ['delta', { text: 'Café ☕' }],
  ['usage', { input_tokens: 10, output_tokens: 3, reasoning_tokens: 2 }],
  ['done', {}],
].map(([event,data])=>`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`).join('');
// Split at every byte, including CRLF and multibyte Unicode boundaries.
const bytes = new TextEncoder().encode(frames);
await readEvents(new ReadableStream({ start(c) {
  for (const byte of bytes) c.enqueue(Uint8Array.of(byte));
  c.close();
}}), (event,data) => applyEvent(a,event,data));
assert.equal(a.blocks[0].status, 'done');
assert.equal(a.blocks[1].status, 'error');
assert.equal(a.blocks[2].text, 'Café ☕');
assert.equal(a.tokens, 15);
assert.equal(a.finished, true);
assert.deepEqual(b, turn(), 'Updates must stay on their originating conversation');
applyEvent(b, 'tool_use_start', { name: 'web_search' });
applyEvent(b, 'error', { message: 'Connection lost' });
assert.equal(b.blocks[0].status, 'interrupted');
assert.equal(b.error, 'Connection lost');
assert.equal(b.finished, true);
for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', '/relative', undefined]) assert.equal(safeUrl(url), null);
assert.equal(safeUrl('https://example.com/page'), 'https://example.com/page');
await assert.rejects(readEvents(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: delta\ndata: {'));c.close();}}),()=>{}), /before the response was complete/);
console.log('Workstation checks passed: fragmented SSE, Unicode, tools, errors, session isolation, safe URLs.');
