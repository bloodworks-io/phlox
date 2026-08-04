# Contributing to Phlox

Thanks for your interest in contributing! Phlox is an experimental, local-first project and contributions of all kinds are welcome.

Before getting started, please read the [Usage Warning](https://github.com/bloodworks-io/phlox#usage-warning-%EF%B8%8F) — Phlox is experimental software intended for educational and personal use.

## Ways to Contribute

- **Bug reports & feature requests** — open an [Issue](https://github.com/bloodworks-io/phlox/issues). Include steps to reproduce, expected vs. actual behaviour, and your platform (macOS/Linux, desktop app or Docker).
- **Code contributions** — fork the repo and open a [Pull Request](https://github.com/bloodworks-io/phlox/pulls).
- **Translations** — help translate the Phlox interface into your language. See [Adding a language](#adding-a-language).

## Development Setup

See the [Setup guide](https://phlox.bloodworks.io/docs/setup) for full installation instructions. In short:

```bash
make install        # install dependencies
make rebuild-dev    # build and run the dev environment
```

Other useful targets are listed via `make help`.

## Adding a Language

Phlox uses [i18next](https://www.i18next.com/) with `react-i18next`. UI strings live in JSON catalogs under `src/locales/<code>/` (e.g. `src/locales/en/common.json`). To add an interface translation:

1. Copy `src/locales/en/` to `src/locales/<your-code>/` (ISO 639-1 code, e.g. `es`, `fr`).
2. Translate the values in `common.json` — keep the keys and `{{interpolation}}` placeholders intact.
3. Register it in `src/i18n.js` (import the catalog and add it to `resources` and `supportedLngs`), and add the locale to `UI_LANGUAGES` in `src/utils/i18n/languages.js`.
4. As the codebase changes, run `npm run i18n` (uses `i18next-cli`) to extract new keys, then translate the new entries in your catalog.

> The clinic/output language (transcription and note generation) is a separate, broader setting and already works for many languages regardless of whether an interface catalog exists yet.

Keep translation PRs focused — one language per pull request, and translate the `value` side of each key only.

## Before Submitting a PR

- Run the checks and make sure they pass:

  ```bash
  make check-all    # lint + typecheck
  ```

- Keep PRs focused — one feature or fix per pull request.
- Describe what the change does, why it's needed, and how you tested it.

## A Note on AI-Generated Code

This repo has made extensive use of AI development tools, and AI-assisted contributions are welcome. However, all AI-generated code must be vetted and understood by you before submitting a PR — please don't submit code you haven't reviewed.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](https://github.com/bloodworks-io/phlox/blob/main/LICENSE).
