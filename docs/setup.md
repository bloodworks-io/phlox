# Setup and Installation

This guide will walk you through setting up and installing Phlox.

## Prerequisites

Before you begin, ensure you have the following prerequisites installed and configured:

1.  **Podman or Docker:**  Phlox uses containerization for easy deployment. Install either [Podman](https://podman.io/) or [Docker](https://www.docker.com/). Podman is recommended for its daemon-less architecture.

2.  **Ollama Instance:** Phlox relies on Ollama to run Large Language Models. You need a running Ollama instance, either:
    - **Locally:** [Install Ollama](https://ollama.com/) on your machine and ensure it's running.  You'll likely want to pull models like `llama3.3`, `mistral`, or similar using `ollama pull <model_name>`.
    - **Remotely:** If you have a server with Ollama running, you can configure Phlox to connect to it.

3.  **Whisper-compatible Transcription Service:** Phlox needs a service to transcribe audio into text. You have a few options:
    - **Speeches (Self-hosted, Recommended for Local):** [Speaches](https://github.com/speeches-ai/speaches) is a self-hostable, open-source Whisper server.  Follow their instructions to set up an instance. This is recommended for local, privacy-focused setups.
    - **Cloud-based Whisper API:** You can use cloud-based Whisper APIs if you prefer (ensure you understand their privacy and cost implications). You'll need to configure Phlox with the API endpoint and necessary credentials.

4.  **Basic Familiarity (Optional but Recommended):**
    - Basic understanding of Python, React, and working with LLMs can be helpful if you intend to customize or contribute to Phlox.

## Quick Start Instructions

Follow these steps for a quick installation:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/bloodworks-io/phlox.git
    cd phlox
    ```

2.  **Build the Docker Image:**
    ```bash
    podman build -t phlox:latest .
    ```
    (Or `docker build -t phlox:latest .` if using Docker)

3.  **Create `.env` File:**
    Create a file named `.env` in the cloned repo and add the following content, **customizing the values** as needed:

    ```env
    # Required
    DB_ENCRYPTION_KEY=your_very_secret_key_here  # Generate a strong, random key!
    TZ=Australia/Melbourne  # Set your Timezone (e.g., America/New_York)
    ```

4.  **Run Phlox:**

    - **Production Deployment:** Use the `podman-compose.yml` file:
        ```bash
        podman-compose up
        ```
        (Or `docker-compose up` if using Docker)

    - **Development Setup:** Use the `podman-compose.dev.yml` file:
        ```bash
        podman-compose -f podman-compose.dev.yml up
        ```
        (Or `docker-compose -f podman-compose.dev.yml up`)

5.  **Access Phlox in your Browser:**
    Open your web browser and navigate to [http://localhost:3000](http://localhost:5000).

6.  **Initial Configuration:**
    Once Phlox is running, access the **Settings** page within the application (found in the sidebar). Configure the following:
    - **Ollama Endpoint:**  Verify or update the Ollama API URL if needed.
    - **Transcription Endpoint:** **Ensure the Whisper API URL is correctly configured to match your transcription service.** Test the connection if possible. Depending on your endpoint configuration, you may need to specift a model and an API-key.
    - **Model Selection:**  Model selection options will depend on the models available in your Ollama instance and compatibility with the Whisper service.
    - **Other Settings:** Your name and specialty are provided as context during many LLM calls. This can improve the output of the LLM.

## Post-Installation Notes

-   **Data Persistence:**  Your application data (database, ChromaDB data) is stored in the `./data` directory relative to your `podman-compose.yml` file.
-   **HTTPS for Browser Recording:**  To use the browser-based audio recording feature, you will need a secure context (HTTPS). For local development with `localhost`, most browsers allow exceptions for microphone access over `http://localhost`, but for any other network access, you'll need HTTPS. Consider setting up a reverse proxy with SSL termination (e.g., using Caddy or Nginx) if you need HTTPS access.


If you encounter further issues, please consult the [Phlox documentation](./README.md) or create an issue on the [GitHub repository](https://github.com/bloodworks-io/phlox/issues).
