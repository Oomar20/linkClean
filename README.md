# LinkClean

A Chrome and Firefox extension that removes the tracking part of X/Twitter post links:

```
https://x.com/user/status/123?s=20&t=abc  →  https://x.com/user/status/123
```

It works when you:

- use **Share → Copy link** on a post,
- select a post link and press **Ctrl+C**,
- copy the URL from the **address bar** (the extension cleans the address shown there), and
- open a tracked post link someone sent you (the extension redirects it to the clean URL before X sees the parameters).

It only touches post links (`/{user}/status/{id}` on `x.com`, `twitter.com` and their `www.`/`mobile.` versions). Other links, such as search URLs, keep their parameters. It removes *every* parameter from a post link, not just a list of known tracking ones, so it keeps working if X renames them.

## Install for development

**Chrome:** go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick this folder.

**Firefox (142 or newer):** go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `manifest.json`. Temporary add-ons are removed when Firefox restarts. For a Flatpak Firefox or Zen, run `npm run build` and load the zip from `web-ext-artifacts/` instead: the Flatpak file picker only passes the one file you pick through to the browser, so loading `manifest.json` leaves the scripts and icons behind. If links aren't being cleaned, open `about:addons` → LinkClean → **Permissions** and allow access to x.com and twitter.com.

You can also launch a fresh browser profile with the extension loaded:

```bash
npm install
npm run run:firefox   # or: npm run run:chrome
```

## Development

```bash
npm test        # unit tests (Node 18+)
npm run lint    # web-ext lint
npm run build   # zip for store upload, written to web-ext-artifacts/
```

| File | Purpose |
| --- | --- |
| `src/clean.js` | The URL-cleaning regex, shared by the extension and the tests |
| `src/main-world.js` | Runs inside the X page and wraps `navigator.clipboard.writeText`/`write`, `DataTransfer.setData`, the `copy` event and `history.pushState`/`replaceState` |
| `rules.json` | `declarativeNetRequest` redirect for tracked post links you open |
| `manifest.json` | Manifest V3, shared by Chrome and Firefox |

The content script runs in the page's own JavaScript context (`"world": "MAIN"`) so it can wrap the clipboard functions X's code calls. It hooks browser APIs rather than X's page layout, so redesigns of the site don't break it.

## License

[MIT](LICENSE)

LinkClean is an independent project and is not affiliated with, endorsed by, or sponsored by X Corp. X and Twitter are trademarks of their respective owners.
