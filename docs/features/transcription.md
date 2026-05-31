# Medical Transcription

Phlox converts audio recordings into structured clinical notes.

## Usage

1. **Record Audio/Upload Files**
- Use in-browser recording or upload audio files
- Upload documents (PDF, Word, images) or paste text content

2. **Generate Note**
- Audio is transcribed using Whisper
- LLM processes transcript into structured note based on selected template

3. **Review & Save**
- Edit generated note content
- Copy to EMR or save locally

## Features

- Live audio recording with pause/resume
- File upload support (audio and documents)
- Template-based note structuring
- Field-specific dictation
- View previous visit summaries
- Progress tracking during processing

## Document Processing

Phlox supports uploading PDFs, images, and text documents for note generation. The processing pipeline is configurable in Settings → Model Settings → LLM tab:

- **Auto (default):** Automatically probes the model for vision capability. If supported, sends document images directly to the vision model. Falls back to text extraction + OCR if not.
- **Vision only:** Always renders document pages as images and sends them to the vision model. Requires a vision-capable model.
- **OCR only:** Extracts text using pypdf with Tesseract OCR fallback. Works with any model but may miss information in scanned documents or images.
