# Aham RAG

Offline desktop app for chatting with your documents. Create topics, upload files, ask questions — all powered by a local LLM with no cloud dependency.

## Prerequisites

1. **Node.js 20+** — [nodejs.org](https://nodejs.org)
2. **Ollama** — [ollama.com](https://ollama.com) (install and run `ollama serve`)
3. Pull the required models:
   ```bash
   ollama pull gemma3:1b
   ollama pull nomic-embed-text
   ```

## Quick Start

```bash
npm install
npm run dev
```

The app opens and guides you through model setup on first run.

## Architecture

```
Electron Main Process (Node.js)
├── SQLite (better-sqlite3)     — topics, documents, conversations, messages
├── LanceDB                     — vector embeddings (768-dim nomic-embed-text)
├── Ollama client (fetch)       — embed + stream chat
└── IPC handlers                — contextBridge API for renderer

Electron Renderer Process (React)
├── Zustand stores              — topics, chat, ollama status
├── react-dropzone              — file upload / drag-and-drop
└── react-markdown              — renders assistant responses
```

## RAG Pipeline

1. **Ingest** — Extract text from PDF/DOCX/TXT/MD → chunk (800 chars, 150 overlap) → embed with `nomic-embed-text` → store in LanceDB
2. **Query** — Embed question → top-6 cosine similarity search (topic-scoped) → build prompt with context → stream `gemma3:1b` response → show with source citations

## Supported File Types

| Extension | Format |
|-----------|--------|
| `.pdf` | PDF documents |
| `.docx` | Microsoft Word |
| `.txt` | Plain text |
| `.md` | Markdown |

## User Data

All data is stored locally in `~/Library/Application Support/aham-rag/`:
- `aham.db` — SQLite metadata
- `lancedb/` — vector embeddings
- `documents/` — copies of uploaded files

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode |
| `npm run build` | Build for production |
| `npm run package` | Build + package into DMG/installer |

## Switching Models

To use a different generation model (e.g. for better quality with 16GB+ RAM), edit the constant in `src/main/services/ollama.service.ts`:

```ts
export const GENERATION_MODEL = 'gemma3:1b'  // change to 'gemma3:4b', 'llama3.2', etc.
```

Then pull the model with `ollama pull <model-name>` and restart the app.
