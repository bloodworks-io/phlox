# Stage 1: Build the React app
FROM node:23-slim as build

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
FROM python:3.13.2-slim

# Set the working directory
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y \
    gcc \
    build-essential \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy the build output and Python server files
COPY --from=build /usr/src/app/build ./build
COPY server/ ./server
RUN mkdir -p /usr/src/app/data
RUN mkdir -p /usr/src/app/static
RUN mkdir -p /usr/src/app/temp

# Install Python dependencies
RUN pip install --no-cache-dir -r /usr/src/app/server/requirements.txt

# Expose necessary ports
EXPOSE 5000

# Define the command to run the FastAPI app
CMD ["uvicorn", "server.server:app", "--host", "0.0.0.0", "--port", "5000"]
