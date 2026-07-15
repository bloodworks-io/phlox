> [!WARNING]
> Phlox is an experimental project. For full details on limitations and risks, please read the **[Usage Warning](#usage-warning-️)** section carefully before proceeding.

<p align="center">
  <img src="/docs/images/readme_logo.png" width="300" alt="Phlox Logo">
</p>

<div align="center">

[![Tests](https://github.com/bloodworks-io/phlox/actions/workflows/coverage.yml/badge.svg)](https://github.com/bloodworks-io/phlox/actions/workflows/coverage.yml)
[![Known Vulnerabilities](https://snyk.io/test/github/bloodworks-io/phlox/badge.svg)](https://snyk.io/test/github/bloodworks-io/phlox/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/bloodworks-io/phlox/badge.svg?branch=main)](https://coveralls.io/github/bloodworks-io/phlox?branch=main)
[![CodeQL](https://github.com/bloodworks-io/phlox/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bloodworks-io/phlox/actions/workflows/github-code-scanning/codeql)
[![Code style: ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

Phlox is a free, open-source, AI scribe with a built-in patient management system and agentic AI capabilities. It's designed as a local-first alternative to SaaS medical scribes that you can run on your own hardware.

## Key Features 
- **🔒 100% Local & Private:** Runs entirely on your machine with no third-party services - all data stays local.
- **🎤 Ambient Note Generation** Convert patient encounters to structured clinical notes using customizable templates.
- **💡 Adaptive Refinement:** Outputs improve the more you use it; Phlox learns from your previous notes.
- **📝 Flexible Template System:**  Structure clinical notes to your preferences, with versioning and automated template generation from example notes.
- **🤖 AI-agent:** Your local assistant with access to medical guidelines, literature, and documentation backed by a local knowledge base.
- **🔌 MCP Server Support:** Connect external tool servers to give your agent new capabilties.
- **✅ Task Manager:**  Parse clinical plans into actionable to-do lists to keep up-to-date with your outstanding tasks.
- **✉️  Correspondence Generation:**  One-click generation of patient letters based on clinical notes.
- **📄 Document Processing:** Take advantage of vision language models to fill-in forms, extract demographics, and more.

<p align="center">
  <img src="/docs/images/readme_screenshot.png" width="500" alt="Phlox Screenshot">
</p>

## Architecture

Ambient scribing is a relatively simple task for LLMs. In particular, large frontier models are very adept at one-shotting a decent note given a transcript and a style example. 

- **Frontend:** Chakra UI (React/[Vite](https://github.com/vitejs/vite))
- **Backend:** FastAPI (Python/[uv](https://github.com/astral-sh/uv))
- **Database:** [SQLCipher](https://github.com/sqlcipher/sqlcipher)
- **Vector DB:** [sqlite-vec](https://github.com/asg017/sqlite-vec)
- **Desktop Wrapper:** [Tauri](https://github.com/tauri-apps/tauri) 
- **LLM Backend:** Any OpenAI-compatible endpoint (incl. Ollama), or bundled [llama.cpp ](https://github.com/ggml-org/llama.cpp) server
- **Transcription:** Any OpenAI Whisper-compatible endpoint or bundled [parakeet.cpp](https://github.com/mudler/parakeet.cpp) server

## Getting Started

### Desktop App

Pre-built Apple Silicon binaries are available from [GitHub Releases](https://github.com/bloodworks-io/phlox/releases). 

The desktop app comes bundled with both transcription and LLM inference engines. Models can be downloaded from within the application.

### Docker/Podman

Pre-built images are available from [GitHub Container Registry](https://github.com/bloodworks-io/phlox/pkgs/container/phlox):

```bash
docker pull ghcr.io/bloodworks-io/phlox:latest
```

The Docker image does not have any inference or transcription capability built-in. OpenAI compatible endpoints are required for transcription and note generation. 

Note quality improves with speaker diarization. [parakeet-diarized](https://github.com/jfgonsalves/parakeet-diarized) provides an easy to use docker container that serves a diarization-enabled OpenAI Whisper-comptaible endpoint.

## Usage Warning 

Phlox is an experimental project intended for educational and personal use. **It is not a certified medical device and should NOT be used for clinical decision-making.**

Phlox is **not** suitable for production deployment in the form provided in this repo. If you intend to use it in a clinical setting, you are responsible for ensuring compliance with local applicable regulations (HIPAA, GDPR, TGA, etc.)

AI outputs can be unreliable. Always verify AI-generated content and use professional clinical judgment. The application displays a disclaimer on startup with full details.

**Security note:** The Docker deployment binds to `0.0.0.0` and has no authentication by default. You MUST place it behind a reverse proxy with an authentication layer like [Authelia](https://github.com/authelia/authelia). Proxy authentication (Traefik, Caddy, Nginx) and rate limiting are supported via environment variables. The desktop app requires a passphrase to unlock the encrypted database.

## Use of AI generated code

This repo has made extensive use of AI development tools - as a solo hobby developer I would simply have not been able to make Phlox otherwise. All AI generated code has been vetted by me and I ask that any contributors do the same prior to submitting PRs.

## License 📄

[MIT License](LICENSE)

## Contributing 🤝

[Contributing Guidelines](.github/CONTRIBUTING.md)
