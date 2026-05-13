# Stage 1: Build React frontend
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY frontend-react/package*.json ./
RUN npm ci
COPY frontend-react/ ./
# VITE_API_URL="" means calls go to the same origin (FastAPI), no /api prefix
RUN VITE_API_URL="" npm run build

# Stage 2: Python backend
FROM python:3.11-slim
WORKDIR /app

RUN useradd -m -u 1000 appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY bills/ ./bills/
COPY data/bills_states.csv ./data/bills_states.csv
COPY data/bill_chunks_cache.json ./data/bill_chunks_cache.json
COPY --from=frontend-builder /build/dist ./frontend-react/dist

RUN mkdir -p data/dense_indices && chown -R appuser:appuser /app

USER appuser

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
