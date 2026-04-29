# Aham RAG — Claude Code Context

## What This Project Is

Offline Electron desktop app for RAG (Retrieval-Augmented Generation). Users create topics, upload documents, and chat with them using a local LLM. No internet required after initial model pull.

## Tech Stack

| Layer | Package |
|-------|---------|
| Desktop | Electron 32 + electron-vite |
| UI | React 18 + TypeScript + Tailwind CSS v4 |
| State | Zustand 5 |
| Generation | `gemma3:1b` via Ollama |
| Embeddings | `nomic-embed-text` via Ollama |
| Vector DB | `@lancedb/lancedb` (embedded) |
| Metadata DB | `better-sqlite3` (SQLite, embedded) |
| Parsers | `pdf-parse`, `mammoth`, Node `fs` |

## Directory Structure

```
src/
├── main/                  # Electron main process (Node.js only)
│   ├── index.ts           # Entry: BrowserWindow, service init, Ollama health poll
│   ├── ipc/               # All ipcMain.handle registrations
│   │   ├── index.ts       # registerAllIPC() hub
│   │   ├── topics.ipc.ts
│   │   ├── documents.ipc.ts
│   │   ├── chat.ipc.ts    # Streams tokens via webContents.send
│   │   └── ollama.ipc.ts
│   ├── services/
│   │   ├── database.service.ts      # SQLite CRUD
│   │   ├── vector-store.service.ts  # LanceDB
│   │   ├── ollama.service.ts        # Ollama HTTP client
│   │   ├── ingestion.service.ts     # doc → chunks → embed → store
│   │   ├── rag.service.ts           # query → search → LLM stream
│   │   └── parsers/                 # pdf, docx, text extractors
│   └── utils/
│       ├── chunker.ts     # Recursive character text splitter
│       └── paths.ts       # getUserDataPath helpers
├── preload/
│   ├── index.ts           # contextBridge.exposeInMainWorld → window.api
│   └── index.d.ts         # TypeScript types for window.api
└── renderer/              # React app
    ├── index.html
    └── src/
        ├── App.tsx
        ├── store/          # Zustand: topics, chat, app (ollama status)
        ├── hooks/          # useTopics, useDocuments, useChat, useOllama
        ├── components/
        │   ├── layout/     # Sidebar, TopBar
        │   ├── topics/     # TopicList, TopicItem, CreateTopicDialog
        │   ├── documents/  # DocumentPanel, FileDropZone, DocumentItem
        │   ├── chat/       # ChatInterface, MessageList, MessageBubble, ChatInput
        │   └── shared/     # OllamaStatusBadge, ModelSetupWizard
        ├── types/index.ts  # Shared TypeScript interfaces
        └── lib/utils.ts    # cn() helper
```

## Critical Architectural Rules

1. **All DB and vector operations happen in the main process only.** Never import `better-sqlite3` or `@lancedb/lancedb` in the renderer or preload. The IPC layer is the only bridge.

2. **Streaming tokens use `webContents.send`, not `ipcMain.handle` return values.** The `chat:send` IPC handle starts the stream and returns early; tokens arrive via `chat:stream-token` push events.

3. **Native modules must not be bundled by Vite.** They are in `externalizeDepsPlugin()` and `rollupOptions.external`. Adding a new native dep requires adding it to both places.

4. **`pdf-parse` must be imported via its lib path** to avoid a test fixture error at require time:
   ```ts
   const pdfParse = require('pdf-parse/lib/pdf-parse')
   ```

5. **LanceDB table creation is lazy.** On first `addChunks()` call, `createTable` is used; subsequent calls use `add()` on the existing table. Check `db.tableNames()` at startup to open existing table.

## Model Config

Both model names are constants in `src/main/services/ollama.service.ts`:
```ts
export const GENERATION_MODEL = 'gemma3:1b'
export const EMBEDDING_MODEL  = 'nomic-embed-text'
```
Change these to swap models. With 16GB RAM, `gemma3:4b` or `llama3.2` are good upgrades.

## Dev Commands

```bash
npm run dev       # Start Electron + Vite dev server
npm run build     # Build all processes
npm run package   # Build + create macOS DMG
```

## Common Gotchas

- `better-sqlite3` must be rebuilt for Electron after `npm install`. The `postinstall` script runs `electron-rebuild -f -w better-sqlite3` automatically.
- LanceDB ships prebuilt NAPI binaries — no rebuild needed, but it must be in `asarUnpack` when packaging.
- If `ollama serve` is not running, all IPC handlers that touch Ollama will return error payloads — they do not throw so the app stays alive.
- The `ModelSetupWizard` overlay is shown when `ollamaRunning === false` or required models are not yet pulled. It auto-dismisses when both conditions are met.

## User Data Location (macOS)

```
~/Library/Application Support/aham-rag/
├── aham.db          # SQLite
├── lancedb/         # LanceDB table files
└── documents/       # Copies of uploaded files
```
