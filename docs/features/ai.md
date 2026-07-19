# AI Features

Phlox includes several AI-powered features for chatting with documents, clinical notes, and medical literature.

## Document Chat
Chat with uploaded medical documents and guidelines:

1. Upload PDFs to collections in the Document Explorer
2. Ask questions about the documents
3. Get responses with citations to specific document sources

Documents can be processed via vision models (when supported) or OCR. The processing mode is configurable in Settings → Model Settings → LLM tab.

<p align="center">
<img src="../images/documents.png" width="500px" alt="Document Chat"/>
</p>

## Reference Chat
Query medical guidelines and literature alongside your notes:

1. Click chat icon in patient view
2. Ask reference questions to clarify terminology or guidelines
3. LLM references the clinical note content in responses
4. The LLM will also make a tool call to the RAG database if required

<p align="center">
<img src="../images/chat.png" width="500px" alt="Reference Chat"/>
</p>

## Agentic Tool-Calling

The chat interface includes a built-in tool-calling system that allows the AI to take actions on your behalf:

### Built-in Tools
- **Transcript Search:** Search the current patient's transcript for relevant information
- **Literature Search:** Query local document collections stored in sqlite-vec
- **PubMed Search:** Search PubMed for medical literature (disabled by default — may expose PHI to external API)
- **Wikipedia Search:** Look up medical terms and topics (disabled by default — may expose PHI)
- **Patient Note Search:** Search through a patient's historical notes
- **Previous Encounter:** Retrieve the patient's most recent previous encounter
- **Outstanding Jobs:** List all patients with incomplete tasks
- **Job Completion:** Mark a specific task as completed
- **Note Creation:** Create a new patient encounter note
- **Todo List:** Manage your global todo list (list, add, complete, delete items)
- **Direct Response:** Handle non-medical queries and general conversation

Tools can be individually enabled or disabled in Settings → Model Settings → Tools tab.

### MCP Server Integration

Connect external tool servers via the Model Context Protocol (MCP):

1. Go to Settings → Model Settings → Tools tab
2. Add an MCP server with a name and HTTP URL
3. Toggle the server on/off and configure PHI filtering
4. Tools from connected servers are automatically available in the chat

MCP servers connect via SSE (Server-Sent Events) transport. When the **Filter Sensitive Data** toggle is enabled for a server, the system strips patient-identifying information from arguments before sending them to the external server.

### Interleaved Thinking

For complex queries, the AI can perform multiple rounds of thinking and tool-calling before producing a final response. This allows it to:
- Search multiple sources before synthesizing an answer
- Chain tool calls (e.g., search notes → find a patient → list their outstanding jobs)
- Reason about which tools to use and when

## Chart Insights
Generate a simulated peer-review and literature correlation for the current encounter. This feature acts as a dynamic textbook or "curbside consult" to broaden your consideration set:

1. After creating a clinical note, click "Generate Chart Insights"
2. The LLM acts as an educational sounding board, analyzing the text to provide:
   - **Case Summary:** A brief synthesis of the documented encounter.
   - **Literature Correlations (Differentials):** A list of conditions commonly associated with the documented symptoms in medical literature.
   - **Standard Workup References (Investigations):** Typical investigations associated with the correlated conditions.
   - **Documentation QA (Considerations):** Highlights potential gaps in the documentation or "red flags" that might need explicit addressing in the note.
3. Review the AI's educational suggestions.
4. Use this as a prompt to ensure your documentation is comprehensive and you haven't anchored prematurely.

**Note:** This feature is strictly an educational and documentation-quality tool. It is NOT a diagnostic tool and does not provide clinical decision support.

<p align="center">
<img src="../images/reasoning.png" width="500px" alt="Chart Insights"/>
</p>

## Adaptive Refinement

Phlox learns your documentation preferences over time to improve note quality:

1. Edit generated content in any template field
