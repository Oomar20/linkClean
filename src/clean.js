// Removes the query string from X/Twitter post links found anywhere in a string.
// Shared by the content script (browser) and the unit tests (Node).
(function (root) {
  // Group 1: the post URL without its query, e.g. https://x.com/user/status/123/photo/1
  // The query stops at whitespace, '#', quotes or angle brackets (so it is safe on HTML),
  // and leaves trailing sentence punctuation in place.
  const TRACKED_POST_URL = new RegExp(
    String.raw`(https?://(?:www\.|mobile\.)?(?:x|twitter)\.com/(?:[A-Za-z0-9_]+|i/web)/status/\d+(?:/[^\s?#"'<>]*)?)` +
      String.raw`\?[^\s#"'<>]*?(?=[.,;:!?)\]]*(?:[\s#"'<>]|$))`,
    'gi'
  );

  function cleanTweetUrls(text) {
    if (typeof text !== 'string' || text.indexOf('?') === -1) return text;
    return text.replace(TRACKED_POST_URL, '$1');
  }

  const api = { cleanTweetUrls };
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.__xLinkCleaner = api;
  }
})(globalThis);
