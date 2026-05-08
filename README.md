# Rauhoita hermostosi

Static interactive NFC digital book MVP.

## Files

- `index.html`: application shell
- `style.css`: mobile-first visual design
- `app.js`: markdown loading, parsing, rendering, navigation, and localStorage
- `content/rauhoita-hermostosi.md`: manuscript source of truth

## Constraints

- static HTML, CSS, and vanilla JavaScript
- no framework
- no backend
- no build step
- manuscript fetched client-side from `content/rauhoita-hermostosi.md`

## Local preview

Because the app fetches the manuscript file, open it through a static server instead of `file://`.

Examples:

```bash
python -m http.server
```

or any equivalent static server.

Then open:

```text
http://localhost:8000/
```
