# Translation guidelines

This site has localized pages (e.g. `ru.html`) based on `index.html`.

## Structure

- `index.html` is the English original and source of truth.
- Translated pages are simplified: no JS, no JSON-LD, no changelog, no libraries/code section, no nav bar.
- SVG icons, logos, and game icons are copied as-is.

## Translation rules

1. **Do not leave English phrases inline in target-language grammar.** Use proper equivalents in the target language or established transliterations.
2. **Translate for the target audience, not word-for-word.** Adapt phrasing to sound natural.
3. **Use established gamedev/tech terminology in the target language.** Prefer terms that the local gamedev community actually uses over obscure native equivalents.
4. **Some technical names stay in English.** Product names, file extensions, library name, and format names are not translated.

## When updating translations

After any content change to `index.html`, check if translated pages need corresponding updates.
