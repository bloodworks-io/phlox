# Architecture Overview
<p align="center">
<img src="images/architecture.png" width="500px" alt="Phlox Architecture"/>
</p>

## Components

### Frontend (React/Chakra UI)
- User interface and interactions
- API calls to backend
- Audio recording and playback
- PDF processing and vision rendering (client-side via PDF.js)

### Backend (FastAPI)
- REST API endpoints
- Core application logic
- Integrates with Ollama or any OpenAI compatible endpoint, Whisper, and ChromaDB
- Database operations
- MCP server management and tool routing

### Database (SQLite)
- Local file-based storage
- Encrypted via `DB_ENCRYPTION_KEY`
- Stores:
  - Patient records
  - Clinical notes
  - Templates
  - Settings
  - Todo items

### LLM
- Local model inference (or remote if preferred)
- Handles:
  - Note generation
  - Clinical summaries
  - Chat and tool-calling
  - RAG queries
  - Reasoning and citations
  - Document/vision processing

### Tool System
- **Built-in tools** registered in the tool registry, including:
  - PubMed search, Wikipedia lookup, literature search
  - Patient note search, transcript search
  - Outstanding job listing and completion
  - Note creation
  - Todo list management
- **MCP tools** loaded dynamically from external MCP servers via SSE transport
- Tool executor dispatches calls and handles streaming vs non-streaming responses
- Interleaved thinking/tool-calling for complex multi-step queries

### Transcription
- Compatible with any Whisper endpoint
- Converts audio to text
- Configurable service selection

#### Transcription Flow
The transcription process involves multiple steps to convert audio into structured clinical notes within the constraints of smaller, locally-hosted models.

1. **Audio Recording/Upload**
   - Browser records audio or accepts file upload
   - Audio sent to backend as WAV format

2. **Initial Transcription (Whisper)**
   - Audio processed by configured Whisper endpoint
   - Returns raw text with timestamps
   - Segments combined into single transcript

3. **Template Processing (LLM)**
   - Transcript broken into template fields to manage context length
   - Each field processed concurrently to:
     1. Extract key points as structured JSON
     2. Perform content refinement
     3. Apply formatting

   This staged approach helps smaller models by:
   - Breaking large transcripts into manageable chunks given most local models' long-range context limitations
   - Using structured JSON to constrain outputs
   - Allowing multiple refinement passes with focused prompts
   - Reducing hallucination risk through structured extraction

4. **Final Assembly**
   - Processed fields combined into complete note
   - Patient context merged
   - Formatting rules applied
   - Results returned to frontend

### Model Considerations

- **Output Quality:** Smaller models can hallucinate or lose coherence with long outputs.

- **Compute Resources:** Async processing of fields improves performance if your backend supports concurrency. Chunking and JSON extraction approach helps maintain structure and accuracy while working within resource constraints.

- **Refinement Passes:** Multiple focused passes produce better results than single large outputs with smaller models. Adaptive refinement instructions make these passes more effective by incorporating user preferences.

Example flow for a single field:
```txt
Audio → Raw Transcription → JSON Extraction → Refinement (style + adaptive rules) → Final Output
```

### RAG (ChromaDB)
- Vector database for document storage
- Requires a tool calling model to be selected
- Enables context-aware queries
- Stores medical document embeddings

### Document/Vision Processing
- Hybrid pipeline with automatic capability probing
- When the configured model supports vision, PDFs and images are sent directly for visual analysis
- Falls back to text extraction (pypdf) with OCR (Tesseract) when vision is unavailable
- Processing mode configurable per deployment: "auto" (default), "vision", or "ocr"

## Data Persistence
- SQLite database and ChromaDB data persisted on host
- Volume mount: `./data:/usr/src/app/data`
- Data preserved across container restarts
