# Stage 1: Build the React app
FROM node:24-slim AS build

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --ignore-scripts

# Copy the rest of the application
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Run the FastAPI app
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.11.32@sha256:df4cae8f3a96d175e2e5f992e597550000edbe78fdc2594d5cd8de1a217f504c /uv /usr/local/bin/uv

# Set the working directory
WORKDIR /usr/src/app

# Set environment variable
ENV DOCKER_CONTAINER=true
# Use the uv-locked project venv at runtime
ENV PATH=/usr/src/app/server/.venv/bin:$PATH

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Create phlox user
RUN useradd -m -u 1000 phlox

# Copy the build output and Python server files
COPY --from=build /usr/src/app/build ./build
COPY --from=build /usr/src/app/CHANGELOG.md ./CHANGELOG.md
COPY server/pyproject.toml server/uv.lock ./server/

# Create directories and set ownership
RUN mkdir -p /usr/src/app/data \
    /usr/src/app/static \
    /usr/src/app/temp && \
    chown -R phlox:phlox /usr/src/app

# Install Python dependencies
RUN uv sync --directory server --locked --no-dev --extra docker

# Pre-cache tiktoken encodings so they don't need to be fetched at runtime
RUN python -c "import tiktoken; tiktoken.get_encoding('cl100k_base')"

# Speaker embedding model for live diarization (pinned; verified after download)
RUN python - <<'EOF'
import hashlib, pathlib, urllib.request

url = (
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/"
    "speaker-recongition-models/3dspeaker_speech_campplus_sv_zh-cn_16k-common.onnx"
)
sha256 = "f682b514c05d947ee3fa91cd6ec6c5c7543479a128373fa29b1faedccd21fd11"
target = pathlib.Path("server/assets/models/campplus-common.onnx")
target.parent.mkdir(parents=True, exist_ok=True)
if not (target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == sha256):
    with urllib.request.urlopen(url) as response:
        data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != sha256:
        raise SystemExit(f"speaker model checksum mismatch: {digest}")
    target.write_bytes(data)
print(f"speaker model ready: {target} ({target.stat().st_size} bytes)")
EOF

# Copy remaining server code
COPY server/ ./server

# Change permissions
RUN chown -R phlox:phlox /usr/src/app

# Switch to phlox user
USER phlox

# Expose necessary ports
EXPOSE 5000

# Define the command to run the FastAPI app
# Uses python -m to respect SERVER_HOST environment variable
CMD ["python", "-m", "server.server"]
