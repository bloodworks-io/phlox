# Contributing to Phlox

Thanks for your interest in contributing! Phlox is an experimental, local-first project and contributions of all kinds are welcome.

Before getting started, please read the [Usage Warning](https://github.com/bloodworks-io/phlox#usage-warning-%EF%B8%8F) — Phlox is experimental software intended for educational and personal use.

## Ways to Contribute

- **Bug reports & feature requests** — open an [Issue](https://github.com/bloodworks-io/phlox/issues). Include steps to reproduce, expected vs. actual behaviour, and your platform (macOS/Linux, desktop app or Docker).
- **Code contributions** — fork the repo and open a [Pull Request](https://github.com/bloodworks-io/phlox/pulls).

## Development Setup

See the [Setup guide](https://phlox.bloodworks.io/docs/setup) for full installation instructions. In short:

```bash
make install        # install dependencies
make rebuild-dev    # build and run the dev environment
```

Other useful targets are listed via `make help`.

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
