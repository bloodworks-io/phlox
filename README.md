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
[![Code style: black](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/bloodworks-io/phlox/issues)

</div>

Phlox is an open-source patient management system integrating AI-powered medical transcription, clinical note generation, and an AI chatbot interface. It's designed to run locally, utilizing local models for inference and transcription.

## Key Features ✨

- **🔒 100% Local & Private:** Runs entirely on your machine with no third-party services - all data stays local. Free and open source forever; the security of your data is in your hands.
- **🖥️ Desktop App:** Native Apple Silicon application with bundled LLM and transcription servers - no external dependencies required.
- **🎤 AI Medical Transcription & Summarization:** Convert patient encounters to structured clinical notes using customizable templates.
- **📝 Flexible Template System:**  Structure clinical notes to your preferences, with versioning and automated template generation from example notes.
- **✅ Task Manager:**  Parse clinical plans into actionable task lists with AI-generated summaries.
- **✉️  Correspondence Generation:**  One-click generation of patient letters based on clinical notes.
- **🤖 AI-chat/RAG:** Chat with an LLM about cases, backed by a local document knowledge base (ChromaDB).
- **💡 Adaptive Refinement:** Outputs improve the more you use it; Phlox learns from your previous notes.
- **📰 Dashboard with RSS Reader:** Stay updated with LLM-summarized articles from medical RSS feeds.

<p align="center">
  <img src="/docs/images/readme_screenshot.png" width="500" alt="Phlox Screenshot">
</p>

## Stack 🛠️

- **Frontend:** Chakra UI (React/[Vite](https://github.com/vitejs/vite))
- **Backend:** FastAPI (Python/[uv](https://github.com/astral-sh/uv))
- **Database:** [SQLCipher](https://github.com/sqlcipher/sqlcipher)
- **Desktop Wrapper:** [Tauri](https://github.com/tauri-apps/tauri) (Rust)
- **LLM Backend:** Ollama, OpenAI-compatible endpoints, or bundled [llama.cpp ](https://github.com/ggml-org/llama.cpp) server
- **Transcription:** Whisper-compatible endpoints or bundled [whisper.cpp](https://github.com/ggml-org/whisper.cpp) server
- **RAG:** [ChromaDB](https://github.com/chroma-core/chroma)

## Quick Start 🚀

### Desktop App (Apple Silicon)

Pre-built Apple Silicon binaries are available from [GitHub Releases](https://github.com/bloodworks-io/phlox/releases).

**Note:** The desktop app provides transcription and correspondence features only. For the full feature set (Chat, RAG, PDF Upload), use the Docker/Podman deployment below.

### Docker/Podman (Full Features)

1. **Prerequisites:** Podman/Docker, Ollama/OpenAI-compatible endpoint, Whisper endpoint.
2. **Hardware Requirements:** For reasonable performance, a GPU (CUDA, ROCm) or Apple M-Series chip is strongly recommended. Without these, especially with larger models, the system will run extremely slowly.
3. **Clone:** `git clone https://github.com/bloodworks-io/phlox.git && cd phlox`
4. **Build:** `docker build -t phlox:latest .`
5. **Environment:** Create `.env` in `phlox/` (see example in documentation).
6. **Run:** `docker-compose up` (Production) or `docker-compose -f docker-compose.dev.yml up` (Development).
7. **Access:** http://localhost:5000

**For detailed setup, feature explanations, and important warnings, please see the [Documentation](./docs/README.md).**

## Deployment Options

### Docker/Podman (Full Features)
The complete Phlox experience with all features:
- Medical transcription and clinical notes
- Correspondence generation
- AI Chat interface
- RAG/document knowledge base
- Dashboard with RSS reader

### Desktop App (Streamlined)
Native desktop application for Apple Silicon:
- Medical transcription and clinical notes
- Correspondence generation
- Bundled llama.cpp and whisper servers - no external dependencies
- All data stored locally. Nothing leaves your machine.

*Additional platforms and full feature parity coming in future releases.*

## Roadmap 🗺️

Here's what's coming next for Phlox:

- [x] Use structured JSON outputs for managing LLM responses
- [x] Add support for OpenAI-compatible endpoints
- [x] Tauri desktop app with local inference (llama.cpp + whisper bundled)
- [ ] MCP server support for custom tools and agentic workflows
- [ ] Advanced template version control
- [ ] Meeting and multi-disciplinary meeting scribing

## Usage Warning ⚠️

Phlox is an experimental project intended for educational and personal use. **It is not a certified medical device and should NOT be used for clinical decision-making.**

Phlox is **not** suitable for production deployment in the form provided in this repo. If you intend to use it in a clinical setting, you are responsible for ensuring compliance with local applicable regulations (HIPAA, GDPR, TGA, etc.)

AI outputs can be unreliable. Always verify AI-generated content and use professional clinical judgment. The application displays a disclaimer on startup with full details.

**Security note:** The Docker deployment binds to `0.0.0.0` by default and has no authentication. You MUST place it behind a reverse proxy with an authentication layer like [Authelia](https://github.com/authelia/authelia). The desktop app requires a passphrase to unlock the encrypted database.

## License 📄

[MIT License](LICENSE)

## Contributing 🤝

[Contributing Guidelines](.github/CONTRIBUTING.md)
