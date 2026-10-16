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

app = FastAPI(title="Stable Cloud RAG Backend API", version="2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Qdrant Cloud Client
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
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

# Lazy-load embedding model container (prevents 502 crash on server boot)
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        print("Initializing FastEmbed model on-demand...")
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedding_model

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

        # 1. Parse PDF
        loader = PyPDFLoader(temp_path)
        docs = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(docs)

        if not chunks:
            raise HTTPException(status_code=400, detail="Could not extract text from PDF.")

        chunk_texts = [chunk.page_content for chunk in chunks]
        model = get_embedding_model()

        # 2. Process embeddings in optimized batches of 40 to protect RAM
        BATCH_SIZE = 40
        embeddings_list = []
        
        for i in range(0, len(chunk_texts), BATCH_SIZE):
            batch_texts = chunk_texts[i:i + BATCH_SIZE]
            batch_generator = model.embed(batch_texts)
            for vector in batch_generator:
                embeddings_list.append(vector.tolist())

        # 3. Construct all points locally
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embeddings_list[i],
                payload={
                    "document_name": file.filename,
                    "page_number": chunk.metadata.get("page", 1),
                    "text": chunk.page_content,
                },
            )
            for i, chunk in enumerate(chunks)
        ]

        # 4. Upsert to Qdrant Cloud in bulk batches of 50 to ensure network reliability
        for i in range(0, len(points), 50):
            qdrant.upsert(collection_name=COLLECTION_NAME, points=points[i:i + 50])

        return {
            "message": "File processed and indexed successfully with batch size 40",
            "filename": file.filename,
            "chunks_count": len(chunks)
        }

    except Exception as e:
        print(f"Upload error: {str(e)}")
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
        model = get_embedding_model()
        query_vector_generator = model.embed([user_query])
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
        print(f"Query error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
def get_storage_stats():
    try:
        collection_info = qdrant.get_collection(COLLECTION_NAME)
        points_count = collection_info.points_count
        MAX_POINTS = 2_000_000  
        
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
        # If collection doesn't exist yet or Qdrant hiccups, return 0 instead of a 502
        return {
            "total_chunks_indexed": 0,
            "estimated_memory_used": "0 MB",
            "free_tier_limit": "1000 MB (1 GB)",
            "usage_percentage": "0%",
            "capacity_remaining": "2,000,000 chunks"
        }


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