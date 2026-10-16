import os
import uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain & Cloud AI imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

load_dotenv()

app = FastAPI(title="Free Cloud RAG Backend API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Qdrant Cloud Cluster
qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY")
)
COLLECTION_NAME = "rag_documents"

try:
    qdrant.get_collection(COLLECTION_NAME)
except Exception:
    qdrant.create_collection(
        collection_name=COLLECTION_NAME,
        # BAAI/bge-small-en-v1.5 outputs 384 dimensions
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

# Initialize Lightweight FastEmbed (ONNX-based, low RAM footprint)
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

# Initialize Free Cloud LLM via Groq
llm = ChatGroq(
    model="openai/gpt-oss-20b",
    temperature=0.2,
    api_key=os.getenv("GROQ_API_KEY")
)


class QueryRequest(BaseModel):
    query: str


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Cloud RAG backend is running live!"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    temp_path = f"./temp_{file.filename}"
    
    try:
        contents = await file.read()
        with open(temp_path, "wb") as f:
            f.write(contents)

        loader = PyPDFLoader(temp_path)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(docs)

        points = []
        for chunk in chunks:
            # Generate embedding vector using FastEmbed
            vector_generator = embedding_model.embed([chunk.page_content])
            vector = list(vector_generator)[0].tolist()

            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "document_name": file.filename,
                        "page_number": chunk.metadata.get("page", 1),
                        "text": chunk.page_content,
                    },
                )
            )

        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

        return {
            "message": "File processed via FastEmbed and indexed successfully",
            "filename": file.filename,
            "chunks_count": len(chunks)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/api/query")
def query_rag(body: QueryRequest):
    user_query = body.query

    if not user_query:
        raise HTTPException(status_code=400, detail="Query string is required")

    try:
        # Generate query vector using FastEmbed
        query_vector_generator = embedding_model.embed([user_query])
        query_vector = list(query_vector_generator)[0].tolist()

        response = qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=3
        )
        search_results = response.points

        retrieved_texts = []
        citations = []

        for hit in search_results:
            payload = hit.payload
            retrieved_texts.append(payload["text"])
            citations.append({
                "documentName": payload.get("document_name", "Document"),
                "pageNumber": payload.get("page_number", 1),
                "textChunk": payload.get("text")[:200] + "..."
            })

        context_str = "\n\n---\n\n".join(retrieved_texts)

        prompt = f"""
You are an expert assistant. Answer the question using ONLY the provided context below.
If the answer cannot be found in the context, state clearly that you do not know.

Context:
{context_str}

User Question: {user_query}
"""
        llm_response = llm.invoke(prompt)

        return {
            "answer": llm_response.content,
            "citations": citations
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
def get_storage_stats():
    try:
        collection_info = qdrant.get_collection(COLLECTION_NAME)
        points_count = collection_info.points_count
        MAX_POINTS = 2_000_000  # ~2 Million vector chunks for 1 GB free limit
        
        estimated_used_bytes = points_count * 2000
        used_mb = round(estimated_used_bytes / (1024 * 1024), 2)
        percentage_used = round((points_count / MAX_POINTS) * 100, 4)

        return {
            "total_chunks_indexed": points_count,
            "estimated_memory_used": f"{used_mb} MB",
            "free_tier_limit": "1000 MB (1 GB)",
            "usage_percentage": f"{percentage_used}%",
            "capacity_remaining": f"{MAX_POINTS - points_count} chunks"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clear")
def clear_documents():
    try:
        qdrant.delete_collection(COLLECTION_NAME)
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )
        return {"message": "Knowledge base cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))