# Stage 1: Build the React app
FROM node:lts-slim as build

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the React app
RUN npm run build

# Stage 2: Run the FastAPI app
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Set the working directory
WORKDIR /usr/src/app

# Set environment variable
ENV DOCKER_CONTAINER=true

RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy the build output and Python server files
COPY --from=build /usr/src/app/build ./build
COPY --from=build /usr/src/app/CHANGELOG.md ./CHANGELOG.md
COPY server/pyproject.toml server/uv.lock ./server/
RUN mkdir -p /usr/src/app/data
RUN mkdir -p /usr/src/app/static
RUN mkdir -p /usr/src/app/temp

# Install Python dependencies
RUN uv pip install --system --no-cache ./server[docker]

# Copy remaining server code
COPY server/ ./server

# Expose necessary ports
EXPOSE 5000

# Define the command to run the FastAPI app
# Uses python -m to respect SERVER_HOST environment variable
CMD ["python", "-m", "server.server"]
