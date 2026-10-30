const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanTweetUrls } = require('../src/clean.js');

test('strips the query from post links on every X/Twitter host', () => {
  const cases = {
    'https://x.com/user/status/123?s=20&t=abc': 'https://x.com/user/status/123',
    'https://twitter.com/user/status/123?s=46': 'https://twitter.com/user/status/123',
    'https://www.x.com/user/status/123?t=1': 'https://www.x.com/user/status/123',
    'https://mobile.twitter.com/user/status/123?t=1': 'https://mobile.twitter.com/user/status/123',
    'http://x.com/user/status/123?t=1': 'http://x.com/user/status/123',
    'https://X.com/User_1/status/123?t=1': 'https://X.com/User_1/status/123',
    'https://x.com/i/web/status/123?t=1': 'https://x.com/i/web/status/123',
    'https://x.com/user/status/123?': 'https://x.com/user/status/123',
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(cleanTweetUrls(input), expected, input);
  }
});

test('keeps path suffixes and fragments', () => {
  assert.equal(
    cleanTweetUrls('https://x.com/user/status/123/photo/1?s=20'),
    'https://x.com/user/status/123/photo/1'
  );
  assert.equal(
    cleanTweetUrls('https://x.com/user/status/123/analytics?t=1'),
    'https://x.com/user/status/123/analytics'
  );
  assert.equal(cleanTweetUrls('https://x.com/user/status/123?t=1#m'), 'https://x.com/user/status/123#m');
});

test('cleans links inside surrounding text', () => {
  assert.equal(
    cleanTweetUrls('look at this https://x.com/a/status/1?s=20 lol'),
    'look at this https://x.com/a/status/1 lol'
  );
  assert.equal(
    cleanTweetUrls('one: https://x.com/a/status/1?s=20\ntwo: https://twitter.com/b/status/2?t=x&s=19'),
    'one: https://x.com/a/status/1\ntwo: https://twitter.com/b/status/2'
  );
});

test('keeps trailing punctuation that is not part of the link', () => {
  assert.equal(cleanTweetUrls('see https://x.com/a/status/1?s=20.'), 'see https://x.com/a/status/1.');
  assert.equal(cleanTweetUrls('(https://x.com/a/status/1?s=20)'), '(https://x.com/a/status/1)');
  assert.equal(cleanTweetUrls('really https://x.com/a/status/1?s=20?!'), 'really https://x.com/a/status/1?!');
});

test('cleans links inside HTML attributes without eating markup', () => {
  assert.equal(
    cleanTweetUrls('<a href="https://x.com/a/status/1?s=20&amp;t=x">post</a>'),
    '<a href="https://x.com/a/status/1">post</a>'
  );
});

test('leaves everything else unchanged', () => {
  const unchanged = [
    '',
    'no links here?',
    'https://x.com/user/status/123',
    'https://x.com/search?q=cats&src=typed_query',
    'https://x.com/user?s=20',
    'https://x.com/home?t=1',
    'https://notx.com/user/status/123?s=20',
    'https://x.com.evil.com/user/status/123?s=20',
    'https://example.com/user/status/123?s=20',
  ];
  for (const input of unchanged) {
    assert.equal(cleanTweetUrls(input), input, input);
  }
  assert.equal(cleanTweetUrls(undefined), undefined);
  assert.equal(cleanTweetUrls(42), 42);
});

test('is idempotent and safe to call repeatedly', () => {
  const once = cleanTweetUrls('https://x.com/a/status/1?s=20');
  assert.equal(cleanTweetUrls(once), once);
  assert.equal(cleanTweetUrls('https://x.com/b/status/2?t=1'), 'https://x.com/b/status/2');
});
