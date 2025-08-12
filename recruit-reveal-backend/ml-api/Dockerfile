# Dockerfile for Recruit Reveal ML API
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Set environment variables
ENV PYTHONPATH=/app
ENV MODEL_DIR=/app/models
ENV MODEL_VERSION=latest
ENV PORT=8000
ENV ALLOWED_ORIGINS=*

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:${PORT}/health')" || exit 1

# Run the application (let uvicorn read PORT env var)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0"]