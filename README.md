> [!WARNING]
> Phlox is an experimental project intended for educational and personal **experimentation** ONLY.
> **AS PROVIDED, IT IS NOT A CERTIFIED MEDICAL DEVICE AND MUST NOT BE USED IN ACTUAL CLINICAL SETTINGS or FOR CLINICAL DECISION-MAKING.**
>
> AI outputs can be unreliable and inaccurate. Always verify information and use professional clinical judgment.
> For full details on limitations and risks, please read the **[Usage Warning](#usage-warning-️)** section carefully before proceeding.

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

- **🔒 100% Local & Private:** Runs entirely on your machine with no third-party services - all data stays local, using only free, open-source tools.
- **🎤 AI Medical Transcription & Summarization:** Convert patient encounters to structured clinical notes using customizable templates.
- **📝 Flexible Template System:**  Structure clinical notes to your preferences, with versioning and automated template generation from example notes.
- **✅ Task Manager:**  Parse clinical plans into actionable task lists with AI-generated summaries.
- **✉️  Correspondence Generation:**  One-click generation of patient letters based on clinical notes.
- **🤖 AI-chat/RAG:** Chat with an LLM about cases, backed by a local document knowledge base (ChromaDB).
- **💡 Adaptive Refinement:** Outputs improve the more you use it; Phlox learns from your previous notes.
- **📰 Dashboard with RSS Reader:** Stay updated with LLM-summarized articles from medical RSS feeds.
- **🆓 Free & Libre Software:** Completely free (as in freedom) - study, modify, and share as you wish.

<p align="center">
  <img src="/docs/images/transcription.png" width="500" alt="Phlox Logo">
</p>

## Stack 🛠️

- **Frontend:** React/Chakra UI
- **Backend:** FastAPI
- **Database:** SQLite
- **LLM Backend:** Ollama or any OpenAI-compatible endpoint
- **Transcription:** Any Whisper compatible endpoint
- **RAG:** ChromaDB

## Quick Start 🚀

1. **Prerequisites:** Podman/Docker, Ollama/OpenAI-compatible endpoint, Whisper endpoint.
2. **Hardware Requirements:** For reasonable performance, a GPU (CUDA, ROCm) or Apple M-Series chip is strongly recommended. Without these, especially with larger models, the system will run extremely slowly.
3. **Clone:** `git clone https://github.com/bloodworks-io/phlox.git && cd phlox`
4. **Build:** `docker build -t phlox:latest .`
5. **Environment:** Create `.env` in `phlox/` (see example in documentation).
6. **Run:** `docker-compose up` (Production) or `docker-compose -f docker-compose.dev.yml up` (Development).
7. **Access:** http://localhost:5000

**For detailed setup, feature explanations, and important warnings, please see the [Documentation](./docs/README.md).**

## Roadmap 🗺️

Here's what's coming next for Phlox:

- [x] Use structured JSON outputs for managing LLM responses
- [x] Add support for OpenAI-compatible endpoints
- [ ] MCP server support for custom tools and agentic workflows
- [ ] Create Electron app packaging for desktop use
- [ ] Develop Progressive Web App (PWA) version
- [ ] Introduce advanced template version control
- [ ] Meeting and multi-disciplinary meeting scribing

## Usage Warning ⚠️

Phlox is an experimental project intended for educational and personal use. **It is not a certified medical device and should NOT be used for clinical decision-making without thorough validation, regulatory approvals, and under the direct supervision of qualified medical professionals.**

**Key limitations:**

*   **Experimental Code:**  The codebase is a work in progress and may contain bugs and inconsistencies.
*   **AI Hallucinations:** LLM outputs, especially from smaller models, can be unreliable, inaccurate, and may present plausible but incorrect information. **Always verify AI-generated content against trusted sources and use your professional clinical judgment.**
*   **No User Authentication:**  Naively exposing this application to the open internet is highly discouraged. Phlox has no user access controls and, for now, next to no input sanitisation.
*   **Not HIPAA/GDPR Compliant:**  Phlox, in the form provided in this repo, lacks the necessary security and compliance measures for handling protected health information in regulated environments.

**Use at your own risk and only for non-clinical, educational purposes unless you have implemented robust security measures and undertaken thorough validation.**

## License 📄

[MIT License](LICENSE)

## Contributing 🤝

[Contributing Guidelines](.github/CONTRIBUTING.md)
