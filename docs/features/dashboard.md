# Agent Dashboard

The Agent Dashboard is a chat-driven hub for clinic management. It combines a conversational AI interface with practical clinic management tools.

## Features

### Chat Interface
- Ask questions about patients, clinical notes, and medical literature
- Upload PDFs and images for analysis (vision or OCR processing based on model capabilities)
- Get inline citations from tool responses with source references
- AI can search transcripts, patient notes, PubMed, and Wikipedia
- Supports interleaved thinking for complex multi-step queries

### Todo Panel
- Manage a global todo list directly from the dashboard
- Add, complete, and delete tasks
- Filter between active and all tasks
- AI can interact with your todo list via tool calls

## Usage

1. **Dashboard Chat:** Type questions or instructions in the chat input. The AI will determine which tools to call based on your query.
2. **File Uploads:** Drag and drop PDFs or images into the chat, or use the attachment button. Files are processed using your configured document processing mode.
3. **Todo Panel:** Expand the todo panel to manage tasks. You can also ask the AI to add or complete tasks for you.

## Tool Capabilities

The dashboard chat has access to built-in tools:
- **Transcript Search:** Search the current patient's transcript
- **Literature Search:** Search your local document collections
- **PubMed Search:** Search PubMed for medical literature (may expose PHI)
- **Wikipedia Search:** Look up medical terms and topics (may expose PHI)
- **Patient Note Search:** Search through a patient's historical notes
- **Outstanding Jobs:** List all patients with incomplete tasks
- **Job Completion:** Mark tasks as completed
- **Note Creation:** Create new patient encounter notes
- **Todo List:** Add, list, complete, and delete todo items

When MCP servers are configured, their tools are also available in the dashboard chat.
