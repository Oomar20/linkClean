// Runs in the page's own JavaScript context ("world": "MAIN") before X's scripts load.
// Wraps the browser APIs X uses to copy links and to update the address bar, so post
// links lose their tracking query whichever way they are copied.
(function () {
  const cleaner = globalThis.__xLinkCleaner;
  delete globalThis.__xLinkCleaner;
  if (!cleaner) return;
  const { cleanTweetUrls } = cleaner;

  const TEXT_TYPES = new Set(['text', 'text/plain', 'text/uri-list', 'url', 'text/html']);
  const isTextType = (type) => typeof type === 'string' && TEXT_TYPES.has(type.toLowerCase());

  // Replaces obj[name] with wrap(original). Any error inside the wrapper falls back to the
  // original call, so a bug here can never break copying on the page.
  function hook(obj, name, wrap) {
    const original = obj && obj[name];
    if (typeof original !== 'function') return;
    const wrapped = wrap(original);
    obj[name] = function (...args) {
      try {
        return wrapped.apply(this, args);
      } catch (err) {
        console.warn('[linkclean]', err);
        return original.apply(this, args);
      }
    };
  }

  // Share menu "Copy link" and most modern copy buttons.
  if (typeof Clipboard !== 'undefined') {
    hook(Clipboard.prototype, 'writeText', (original) =>
      function (data, ...rest) {
        return original.call(this, cleanTweetUrls(data), ...rest);
      }
    );

    if (typeof ClipboardItem !== 'undefined') {
      hook(Clipboard.prototype, 'write', (original) =>
        function (items, ...rest) {
          // Values are rebuilt as promises so the call stays synchronous and keeps the
          // user-activation the browser requires for clipboard writes.
          const cleaned = Array.from(items, (item) => {
            if (!item.types.some(isTextType)) return item;
            const entries = item.types.map((type) => [
              type,
              isTextType(type)
                ? item
                    .getType(type)
                    .then((blob) => blob.text())
                    .then((text) => new Blob([cleanTweetUrls(text)], { type }))
                : item.getType(type),
            ]);
            return new ClipboardItem(Object.fromEntries(entries), {
              presentationStyle: item.presentationStyle,
            });
          });
          return original.call(this, cleaned, ...rest);
        }
      );
    }
  }

  // Copy-event handlers and document.execCommand('copy') fallbacks.
  if (typeof DataTransfer !== 'undefined') {
    hook(DataTransfer.prototype, 'setData', (original) =>
      function (type, data, ...rest) {
        return original.call(this, type, isTextType(type) ? cleanTweetUrls(data) : data, ...rest);
      }
    );
  }

  // Plain Ctrl+C on selected text that contains a post link.
  function selectedText() {
    const el = document.activeElement;
    if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
      try {
        if (typeof el.selectionStart === 'number' && el.selectionStart !== el.selectionEnd) {
          return el.value.slice(el.selectionStart, el.selectionEnd);
        }
      } catch (_) {
        // Some input types don't support selection.
      }
    }
    const selection = document.getSelection();
    return selection ? selection.toString() : '';
  }

  document.addEventListener(
    'copy',
    (event) => {
      if (!event.clipboardData) return;
      const text = selectedText();
      const cleaned = cleanTweetUrls(text);
      if (cleaned === text) return;
      event.clipboardData.setData('text/plain', cleaned);
      event.preventDefault();
    },
    true
  );

  // Address bar: clean the current URL now, and every URL X navigates to in-page.
  function cleanUrlArg(url) {
    if (url == null) return url;
    const absolute = new URL(String(url), location.href).href;
    const cleaned = cleanTweetUrls(absolute);
    return cleaned === absolute ? url : cleaned;
  }

  for (const name of ['pushState', 'replaceState']) {
    hook(History.prototype, name, (original) =>
      function (...args) {
        if (args.length > 2) args[2] = cleanUrlArg(args[2]);
        return original.apply(this, args);
      }
    );
  }

  try {
    const cleaned = cleanTweetUrls(location.href);
    if (cleaned !== location.href) history.replaceState(history.state, '', cleaned);
  } catch (err) {
    console.warn('[linkclean]', err);
  }
})();
