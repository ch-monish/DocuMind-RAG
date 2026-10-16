FROM python:3.11-slim

WORKDIR /app

# Install basic build utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

EXPOSE 5000

# Run FastAPI production server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]