# Phlox Overview

## What is Phlox?

Phlox is an open-source, local-first clinical tool with the following features:

- **Patient Records:** Basic database for patient demographics and history
- **Medical Transcription:** Uses Whisper + local or remote LLMs to convert audio to structured notes
- **Task Management:** Extracts action items from clinical notes and tracks their completion
- **Agentic Tool-Calling:** Built-in tools for PubMed search, Wikipedia lookup, patient note search, transcript search, job management, and note creation — with interleaved thinking for complex multi-step queries
- **MCP Server Support:** Connect external tool servers via the Model Context Protocol (SSE transport) with optional PHI filtering
- **AI Assistant:** RAG system using ChromaDB for querying medical literature and guidelines alongside your notes. Encounter summarization interface with inline citations from tool responses.
- **Agent Dashboard:** Chat-driven clinic management hub with built-in todo panel, outstanding jobs view, and clinic summary by date
- **Vision-Enhanced Document Processing:** Hybrid PDF processing with automatic capability probing — uses vision models directly when available, falling back to OCR

## Design

- Runs locally on standard hardware
- Customizable templates and LLM settings
- All data stays on your machine
- Extensible via MCP server integration for custom tools and agentic workflows

## Philosophy

The core idea is to use LLMs to automate administrative tasks by:
- Surfacing relevant information from guidelines and journals
- Automating documentation tasks
- Organizing and structuring clinical notes
- Providing an agentic chat interface that can take actions on your behalf (search notes, manage tasks, create encounters)

## Important Caveats

- LLMs can hallucinate plausible but incorrect information
- Verification against primary medical sources is mandatory
- Clinical judgment remains supreme
- Models can misinterpret or omit important context
- External MCP servers may receive PHI depending on configuration — use the sensitive data filtering toggle when connecting to third-party services

This is an experimental administrative tool designed to assist with documentation and reference, not to provide clinical decision support.
