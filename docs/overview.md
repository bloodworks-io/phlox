# Phlox Overview

## What is Phlox?

Phlox is an open-source, local-first clinical tool with the following features:

- **Patient Records:** Basic database for patient demographics and history
- **Medical Transcription:** Uses Whisper + Ollama to convert audio to structured notes
- **Task Management:** Extracts action items from clinical notes
- **RSS Reader:** Aggregates and summarizes medical news using LLMs
- **AI Assistant:** RAG system using ChromaDB for querying medical literature and guidelines alongside your notes. Encounter summarization interface.

## Design

- Runs locally on standard hardware
- Customizable templates and LLM settings
- All data stays on your machine

## Philosophy

The core idea is to use LLMs to automate administrative tasks by:
- Surfacing relevant information from guidelines and journals
- Automating documentation tasks
- Organizing and structuring clinical notes

## Important Caveats

- LLMs can hallucinate plausible but incorrect information
- Verification against primary medical sources is mandatory
- Clinical judgment remains supreme
- Models can misinterpret or omit important context

This is an experimental administrative tool designed to assist with documentation and reference, not to provide clinical decision support.
