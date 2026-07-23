# Third-Party Models, Runtimes, and Licenses

Phlox bundles and downloads a number of third-party components whose licenses require attribution. 

## Large Language Models

### Omi Med STT v1 (q8_0 GGUF)

- **Creator:** omi-health
- **Source:** https://huggingface.co/omi-health/omi-med-stt-v1-gguf
- **License:** [Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Derivative of:** [nvidia/parakeet-tdt-0.6b-v2](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2) (CC-BY-4.0)

### Qwen3.5 (0.8B / 2B / 4B / 9B / 27B / 35B-A3B GGUF)

- **Creator:** Qwen Team at Alibaba Cloud; GGUF quantizations by [Unsloth](https://huggingface.co/unsloth)
- **Source:** https://huggingface.co/unsloth/Qwen3.5-*-GGUF
- **License:** [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)

### Qwen3-Embedding-0.6B (Q8_0 GGUF)

- **Creator:** Qwen Team at Alibaba Cloud
- **Source:** https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF
- **License:** [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Bundled Inference Runtimes

### parakeet.cpp

- **Authors:** Ettore Di Giacinto (@mudler), Richard Palethorpe; the [LocalAI](https://github.com/mudler/LocalAI) team
- **Source:** https://github.com/mudler/parakeet.cpp
- **License:** [MIT](https://github.com/mudler/parakeet.cpp/blob/master/LICENSE)

### llama.cpp

- **Source:** https://github.com/ggml-org/llama.cpp
- **License:** [MIT](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE)

## Bundled System Components

### Tesseract OCR

- **Source:** https://github.com/tesseract-ocr/tesseract
- **License:** [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)

### SQLCipher

- **Source:** https://github.com/sqlcipher/sqlcipher
- **License:** [BSD-3-Clause with OpenSSL Exception](https://github.com/sqlcipher/sqlcipher/blob/master/LICENSE)

## Notable Dependencies

The following Apache-2.0 / copyleft dependencies are used by Phlox. Each retains its original license and copyright notices.

**Python:**
- [openai](https://github.com/openai/openai-python) — Apache-2.0
- [mcp](https://github.com/modelcontextprotocol/python-sdk) — MIT
- [pytesseract](https://github.com/madmaze/pytesseract) — Apache-2.0

**JavaScript:**
- [pdfjs-dist](https://github.com/mozilla/pdf.js) — Apache-2.0 
- [@tauri-apps/api](https://github.com/tauri-apps/tauri), [@tauri-apps/plugin-http](https://github.com/tauri-apps/plugins-workspace) — Apache-2.0 / MIT

The complete list of Python dependencies with resolved licenses is in [`server/uv.lock`](../server/uv.lock). The complete list of JavaScript dependencies is in [`package-lock.json`](../package-lock.json). All third-party packages retain their original licenses and copyright notices.
