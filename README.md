> [!WARNING]
> Phlox is an experimental project. Please read the **[Usage Warning](#usage-warning-️)** section carefully before proceeding.

<p align="center">
  <img src="/docs/images/phlox_icon.png" width="150" alt="Phlox Logo">
</p>

<div align="center">

[![Tests](https://github.com/bloodworks-io/phlox/actions/workflows/coverage.yml/badge.svg)](https://github.com/bloodworks-io/phlox/actions/workflows/coverage.yml)
[![Coverage Status](https://coveralls.io/repos/github/bloodworks-io/phlox/badge.svg?branch=main)](https://coveralls.io/github/bloodworks-io/phlox?branch=main)
[![CodeQL](https://github.com/bloodworks-io/phlox/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/bloodworks-io/phlox/actions/workflows/github-code-scanning/codeql)
[![Code style: ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

Phlox is a free, open-source, AI scribe with a built-in patient management system and agentic AI capabilities. It's designed as a local-first alternative to SaaS medical scribes that you can run on your own hardware.

## Key Features 
- **🔒 100% Local & Private:** Runs entirely on your machine with no third-party services - all data stays local.
- **🎤 Ambient Note Generation** Automatically generate structured clinical notes with customizable templates.
- **💡 Adaptive Refinement:** Outputs improve the more you use it; Phlox learns from your previous notes.
- **📝 Flexible Template System:**  Including automated template generation from example notes you provide.
- **🤖 AI-agent:** Your local assistant with access to literature in your own local knowledge base.
- **🔌 MCP Server Support:** Connect external tool servers to give your agent new capabilties.
- **✅ Task Manager:**  Parse clinical plans into actionable to-do lists to keep up-to-date with your outstanding tasks.
- **✉️  Correspondence Generation:**  One-click generation of patient letters based on clinical notes.
- **📄 Document Processing:** Fill-in forms, extract demographics, and more using local Vision Language Models.

<p align="center">
  <img src="/docs/images/readme_screenshot.png" width="600" alt="Phlox Screenshot">
</p>

## Getting Started

### Desktop App

Pre-built Apple Silicon (macOS) binaries and Flatpaks (Linux - Vulkan) are available from [GitHub Releases](https://github.com/bloodworks-io/phlox/releases). 

The desktop app comes bundled with both transcription and LLM inference engines. Models can be downloaded from within the application.

### Docker/Podman

Pre-built images are available from [GitHub Container Registry](https://github.com/bloodworks-io/phlox/pkgs/container/phlox):

```bash
docker pull ghcr.io/bloodworks-io/phlox:latest
```

Minimal `docker-compose.yml` for the pre-built image:

```yaml
services:
  phlox:
    image: ghcr.io/bloodworks-io/phlox:latest
    container_name: phlox
    ports:
      - "5000:5000"  # Use "127.0.0.1:5000:5000" if not behind a reverse proxy
    environment:
      - DB_ENCRYPTION_KEY=          # Required: generate a strong random key
      - TZ=                         # e.g. America/New_York
      - ALLOWED_ORIGINS=*           # Or your origin, e.g. https://phlox.example.com
      # Optional — proxy auth + rate limiting (see docs/setup.md#critical-security-warning)
      # - PROXY_AUTH_ENABLED=true
      # - PROXY_AUTH_USER_HEADER=X-Forwarded-User
      # - PROXY_AUTH_ALLOWED_USERS=user1,user2
      # - RATE_LIMIT_ENABLED=true
    volumes:
      - ./data:/usr/src/app/data    # Persistent data (database, vectors)
      - ./logs:/usr/src/app/logs    # Optional: persist logs
```

Then `docker compose up -d`. See the [Setup guide](docs/setup.md) for full instructions including `.env` configuration.

The Docker image does not have any inference or transcription capability built-in. OpenAI compatible endpoints are required for transcription and note generation. 

Note quality benefits from speaker diarization. [parakeet-diarized](https://github.com/jfgonsalves/parakeet-diarized) provides an easy to use Docker container that serves a diarization-enabled OpenAI Whisper-comptaible endpoint.

## Architecture

Ambient scribing is a relatively simple task for LLMs. In particular, large frontier models are very adept at one-shotting a decent note given a transcript and a style example. Smaller models capable of running on consumer hardware are able to summarise medical consultations reasonably well; however, they often struggle with replicating specific note styles.

Phlox approaches this by chunking transcripts per template field and constraining outputs to structured JSON. After getting the model to make a targeted summary for a given field, a dedicated refinement pass then allows the model to focus on matching output to the users personal style example. Finally an adaptive-refinement feedback loop allows the model to improve note quality as it is used more.

### Technical Stack

- **Frontend:** [Chakra UI](https://github.com/chakra-ui/chakra-ui) (React)
- **Backend:** [FastAPI](https://github.com/fastapi/fastapi) (Python)
- **Database:** [SQLCipher](https://github.com/sqlcipher/sqlcipher)
- **Vector DB:** [sqlite-vec](https://github.com/asg017/sqlite-vec)
- **Desktop Wrapper:** [Tauri](https://github.com/tauri-apps/tauri) 
- **LLM Backend:** Any OpenAI-compatible endpoint (incl. Ollama), or bundled [llama.cpp ](https://github.com/ggml-org/llama.cpp) server
- **Transcription:** Any OpenAI Whisper-compatible endpoint or bundled [parakeet.cpp](https://github.com/mudler/parakeet.cpp) server

## Usage Warning 

Phlox is an experimental project intended for educational and personal use only. **It is not a certified medical device, should NOT be used for clinical decision-making, and is not suitable for production deployment as provided in this repo.** If you intend to use it in a clinical setting, you are responsible for ensuring compliance with local applicable regulations (HIPAA, GDPR, TGA, etc.)

AI outputs can be unreliable. Always verify AI-generated content and use professional clinical judgment. The application displays a disclaimer on startup with full details.


## License 

[MIT License](LICENSE)

Third-party models, runtimes, and library attributions: [Credits](docs/credits.md).

## Contributing 

[Contributing Guidelines](.github/CONTRIBUTING.md)

This repo has made extensive use of AI development tools. All AI generated code has been vetted by me and I ask that any contributors do the same prior to submitting PRs.
