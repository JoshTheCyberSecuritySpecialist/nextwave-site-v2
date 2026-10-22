import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('homepage uses the existing CRM demo without autoplay', async () => {
  const video = await stat(new URL('../public/videos/nextwave-crm-demo.mp4', import.meta.url));
  const poster = await stat(new URL('../public/videos/nextwave-crm-demo-poster.jpg', import.meta.url));
  assert.ok(video.size > 1_000_000);
  assert.ok(poster.size > 1_000);

  const demo = await readFile(new URL('../src/components/ProductDemo.tsx', import.meta.url), 'utf8');
  const home = await readFile(new URL('../src/pages/Home.tsx', import.meta.url), 'utf8');
  assert.match(demo, /src="\/videos\/nextwave-crm-demo\.mp4"/);
  assert.match(demo, /poster="\/videos\/nextwave-crm-demo-poster\.jpg"/);
  assert.match(demo, /\bcontrols\b/);
  assert.doesNotMatch(demo, /autoPlay|autoplay/);
  assert.match(demo, /Explore Our Booking & CRM Solutions/);
  assert.match(demo, /href="#packages"/);
  assert.match(demo, /fictional customer/);
  assert.match(home, /<ProductDemo \/>/);
  assert.doesNotMatch(home, /<video/);
});
