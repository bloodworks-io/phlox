# Setup and Installation

This guide will walk you through setting up and installing Phlox.

## Prerequisites

Before you begin, ensure you have the following prerequisites installed and configured:

1.  **Podman or Docker:**  Phlox uses containerization for easy deployment. Install either [Podman](https://podman.io/) or [Docker](https://www.docker.com/). I like Podman because it is rootless and daemonless.

2.  **LLM Endpoint:** Phlox supports multiple types of LLM providers. The model you choose must support tool calling:

    - **Ollama (Easiest):** [Install Ollama](https://ollama.com/) locally for self-hosted models
      - A few models that work well:
        - **Standard Hardware:** `llama3.3:8b` (smaller, faster)
        - **Performance-Optimized:** `llama3.3:70b` (better quality but requires more resources)

    - **OpenAI-Compatible Servers (Self-hosted):**
      - [vLLM](https://github.com/vllm-project/vllm): High-throughput LLM serving
      - [llama.cpp](https://github.com/ggerganov/llama.cpp): LLM inference in C/C++
      - [sglang](https://github.com/sgl-project/sglang): Structured generation language

    > **For best privacy:** Use self-hosted solutions
    >
    > **For best performance:** vLLM offers excellent throughput especially if taking advantage of tensor parallelism.
    >
    > **Advanced Reasoning:** The [Qwen3-30B-A3B](https://huggingface.co/Qwen/Qwen3-30B-A3B) MoE model provides llama3.3-70b level performance with lower resource requirements and much better token generation speed. This is what I use day-to-day.

3.  **Whisper-compatible Transcription Service:** Phlox needs a service to transcribe audio into text. I recommend self-hosted solutions:
    - **High-Performance Options:**

      - **[Parakeet Diarized](https://github.com/jfgonsalves/parakeet-diarized):** A solution I use that leverages NVIDIA Parakeet-TDT 0.6B V2 (Top ASR model on HF leaderboard) + Pyannote diarization. Diarization improves model comprehension for downstream tasks but has relatively steep VRAM requirements. [See Parakeet-Diarized Setup instructions](#parakeet-diarized-setup).

      - **[Speaches](https://github.com/speaches-ai/speaches):** Lightweight Dockerized Whisper server.

4.  **Hardware Considerations:**

    - **For best performance:** A GPU (CUDA, ROCm) or Apple M-Series chip is strongly recommended (at the moment you can't use Docker to install on an M-Series Mac; will have to be a bare metal installation)

    - **Without GPU/Apple silicon:** The system will run but will be unusably slow, especially with larger models

    - **Quantization:** Using Q4 quantization can significantly reduce memory usage and improve token generation speed without significant degrading output quality.

          - **KV Cache Quantization:** This is an advanced configuration option that can further reduce memory usage. Aggressive KV cache quantization (smaller than Q8) is not recommended for heavily context-dependent tasks like those in Phlox.

    - **RAM Recommendations (assuming Q4 quants):**
      - 8GB minimum for smaller models
      - 16GB+ recommended for better performance
      - 32GB+ for large models like llama3.3:70b
      - Additional memory will be required depending on your choice of transcription service.

## Quick Start Instructions

Follow these steps for a quick installation:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/bloodworks-io/phlox.git
    cd phlox
    ```

2.  **Build the Docker Image:**
    ```bash
    docker build -t phlox:latest .
    ```

3.  **Create `.env` File:**
    Create a file named `.env` within the cloned respository and add the following content, **customizing the values** as needed:

    ```env
    # Required
    DB_ENCRYPTION_KEY=your_very_secret_key_here  # Generate a strong, random key!
    TZ=Australia/Melbourne  # Set your Timezone (e.g., America/New_York)

    # Optional - Security
    PROXY_AUTH_ENABLED=false          # Enable reverse proxy authentication
    PROXY_AUTH_USER_HEADER=X-Forwarded-User  # Header containing authenticated username
    PROXY_AUTH_ALLOWED_USERS=user1,user2     # Comma-separated list of allowed users
    RATE_LIMIT_ENABLED=false          # Enable rate limiting

    # Optional - LLM
    LLM_EXTRA_BODY={"chat_template_kwargs": {"thinking": true}}  # Extra params for LLM requests (JSON string)
    ```

4.  **Run Phlox:**

    - **Production Deployment:** Use the `docker-compose.yml` file:
        ```bash
        docker-compose up
        ```
    - **Development Setup:** Use the `docker-compose.dev.yml` file:
        ```bash
        docker-compose -f docker-compose.dev.yml up
        ```

5.  **Access Phlox in your Browser:**
    Open your web browser and navigate to [http://localhost:3000](http://localhost:5000).

6.  **Initial Configuration:**
    Once Phlox is running, access the **Settings** page within the application:
    - **Provider:** Select "Ollama" or "OpenAI-Compatible" and update the endpoint URL.
    - **Transcription Endpoint:** Depending on your endpoint configuration, you may need to specify a model and an API-key.
    - **Model Selection:**  Model selection options will depend on the models reported as available by your chosen endpoint.
    - **Document Processing Mode:** Choose "Auto", "Vision", or "OCR" depending on your model's capabilities. Use the vision capability probe to test your endpoint.
    - **Tools:** Enable/disable built-in tools and configure external MCP servers in the Tools tab.
    - **Other Settings:** Your name and specialty are provided as context during many LLM calls. This can improve the output of the LLM.

### Parakeet-Diarized Setup
```bash
# Install Parakeet diarized server
git clone https://github.com/jfgonsalves/parakeet-diarized
cd parakeet-diarized
pip install -r requirements.txt

# Get HuggingFace token (required for diarization)
# https://huggingface.co/settings/tokens

# Start server
./run.sh --hf-token "your_hf_token" --port 8000
```

### Configuration Tips
- Enable diarization in Phlox settings for speaker-aware transcripts
- Use shorter audio segments (<5 minutes) for best diarization accuracy
- For multi-speaker clinics, diarization significantly improves note quality

## Post-Installation Notes

-   **Data Persistence:**  Your application data (database, ChromaDB data) is stored in the `./data` directory relative to your `docker-compose.yml` file.
-   **HTTPS for Browser Recording:**  To use the browser-based audio recording feature, you will need a secure context (HTTPS). For local development with `localhost`, most browsers allow exceptions for microphone access over `http://localhost`, but for any other network access, you'll need HTTPS. Consider setting up a reverse proxy with SSL termination (e.g., using Caddy or Nginx) if you need HTTPS access.


## Critical Security Warning

⚠️ **By default, Phlox binds to 0.0.0.0 (all network interfaces) for development convenience.**

**If exposed to the internet without protection:**
   - Anyone can access your instance
   - All data could be stolen

**Never expose Phlox to the open internet without some form of reverse proxy (Nginx/Caddy) or VPN.**

For production deployments behind a reverse proxy, enable proxy authentication:
```env
PROXY_AUTH_ENABLED=true
PROXY_AUTH_USER_HEADER=X-Forwarded-User
PROXY_AUTH_ALLOWED_USERS=your_username
RATE_LIMIT_ENABLED=true
```

If you encounter problems, please create an issue on the [GitHub repository](https://github.com/bloodworks-io/phlox/issues).
