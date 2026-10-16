# ⚡ Full-Stack RAG Knowledge Engine

An enterprise-ready, production-grade **Retrieval-Augmented Generation (RAG) System** built to convert unstructured PDF documents into an interactive, grounded knowledge base. 

The application utilizes a modern **Next.js** frontend paired with a high-performance **FastAPI** backend. Document embeddings are computed locally using **SentenceTransformers** (`all-MiniLM-L6-v2`) and indexed into **Qdrant Cloud Vector Database** for sub-millisecond similarity search. Language generation is powered by **Groq**'s ultra-low latency Llama-3 inference engine, constrained strictly to retrieved context to eliminate hallucinations.

---

## 🌟 Key Features

* **📄 PDF Processing & Ingestion:** Async upload handling with automatic text parsing, metadata tagging (filename, page numbers), and recursive character chunking ($1000$ chars, $200$ overlap).
* **🧠 Zero-Cost Local Embeddings:** Runs `sentence-transformers/all-MiniLM-L6-v2` locally on CPU/GPU ($384$-dimensional vectors), completely bypassing cloud embedding API rate limits and costs.
* **⚡ High-Speed Vector Retrieval:** Managed Qdrant Cloud integration using Cosine Distance metric for semantic search.
* **🛡️ Grounded Context Generation:** Custom system prompts force the LLM to answer *strictly* using retrieved context, returning explicit source citations (document name, page number, and text snippet).
* **📊 Real-Time Storage Monitor:** Real-time polling API endpoint showing vector count, estimated cluster memory usage, and capacity percentage.
* **🧹 Knowledge Base Cleanup:** One-click clear endpoint to purge vector indexes and re-initialize vector spaces without cluster downtime.
* **🎨 Modern UI/UX:** Dark-mode dashboard built with Tailwind CSS, TypeScript, active upload states, markdown rendering, and collapsible source drawers.

---

## 🏗️ Architecture & Data Flow

```text
[ User Interface ] ── (1) Upload PDF ────────► [ FastAPI Backend ]
       │                                              │
       │                                       (2) Parse & Chunk Text
       │                                              │
       │                                       (3) Local Embeddings
       │                                           (SentenceTransformers)
       │                                              │
       │                                              ▼
       │                                    [ Qdrant Cloud Cluster ]
       │                                    (384-dim Cosine Vectors)
       │                                              │
       ├── (4) Send Query ────────────────────────────┤
       │                                              │ (5) Vector Similarity
       │                                              │     Search (Top-K)
       │                                              ▼
       │                                     [ Grounded Context ]
       │                                              │
       │                                              ▼
       │                                    [ Groq LLM Inference ]
       │                                    (llama-3.3-70b / gpt-oss)
       │                                              │
       └── (6) Streamed Answer + Citations ───────────┘
```

---

## 🛠️ Tech Stack

### **Frontend**
* **Framework:** Next.js (App Router, React 19)
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Icons & UI:** Lucide React, Framer Motion

### **Backend**
* **Framework:** FastAPI (Python 3.11+)
* **Orchestration:** LangChain Ecosystem
* **PDF Processing:** PyPDF & LangChain Text Splitters
* **Embeddings:** HuggingFace / SentenceTransformers (`all-MiniLM-L6-v2`)
* **LLM Engine:** Groq Cloud API (`ChatGroq`)
* **Vector Storage:** Qdrant Cloud DB (`qdrant-client`)

---

## 📋 Prerequisites

Before running the project, ensure you have the following installed and configured:

* **Node.js:** v18.0.0 or higher
* **Python:** v3.11 or higher
* **Qdrant Cloud Account:** Free cluster tier ([qdrant.tech](https://qdrant.tech/))
* **Groq API Key:** Free developer account ([console.groq.com](https://console.groq.com/))

---

## 📂 Project Structure

```text
rag-knowledge-engine/
├── rag-backend/
│   ├── app.py               # Main FastAPI entry point & RAG pipeline logic
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend container definition
│   └── .env                 # Backend environment variables
└── rag-frontend/
    ├── app/                 # Next.js App Router
    ├── components/          # Reusable UI components (Sidebar, Chat, Citations)
    ├── types/               # TypeScript interface definitions
    ├── Dockerfile           # Frontend container definition
    └── .env.local           # Frontend environment variables
```

---

## 🚀 Local Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/rag-knowledge-engine.git
cd rag-knowledge-engine
```

### 2. Backend Setup (`rag-backend`)
```bash
cd rag-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside `rag-backend/`:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
QDRANT_URL=https://your-cluster-id.us-east-1-0.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here
```

Start the FastAPI development server:
```bash
uvicorn app:app --reload --port 5000
```
*Backend API will run at `http://localhost:5000`*

### 3. Frontend Setup (`rag-frontend`)
Open a new terminal window:
```bash
cd rag-frontend

# Install dependencies
npm install
```

Create a `.env.local` file inside `rag-frontend/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the Next.js development server:
```bash
npm run dev
```
*Frontend app will run at `http://localhost:3000`*

---

## 🐳 Docker Deployment

You can containerize and deploy both services locally or to production using Docker.

### Running Backend with Docker
```bash
cd rag-backend
docker build -t rag-backend .
docker run -d -p 5000:5000 --env-file .env rag-backend
```

### Running Frontend with Docker
```bash
cd rag-frontend
docker build -t rag-frontend .
docker run -d -p 3000:3000 -e NEXT_PUBLIC_API_URL="http://localhost:5000" rag-frontend
```

---

## 📡 API Endpoint Documentation

| Method | Endpoint | Description | Request Body / Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status check. | None |
| `POST` | `/api/upload` | Ingests PDF file, chunks text, generates embeddings, and uploads to Qdrant. | `multipart/form-data` (`file`: PDF) |
| `POST` | `/api/query` | Executes similarity search & generates grounded answer with citations. | `{"query": "string"}` |
| `GET` | `/api/stats` | Retrieves real-time Qdrant cluster vector stats & memory metrics. | None |
| `POST` | `/api/clear` | Purges the active collection vector index and resets storage. | None |

---

## 💼 Resume Showcase Highlights

* **End-to-End RAG Engineering:** Architected a high-throughput RAG platform capable of context-grounded retrieval and low-latency inference.
* **Cost & Compute Optimization:** Eliminated third-party embedding costs by integrating local CPU-optimized `sentence-transformers`, reducing operational costs to **$0/month**.
* **Strict Guardrails & Hallucination Suppression:** Implemented prompt engineering patterns and retrieval thresholding to guarantee accurate citations.
* **Vector Storage Management:** Built custom lifecycle management logic using Qdrant vector spaces, including cluster capacity monitoring and collection purges.
* **Production Deployment:** Configured for seamless 24/7 cloud deployment across Vercel (Frontend), Render (FastAPI), and Qdrant Cloud.
