# Stage 1: Build frontend
FROM node:20-alpine3.19 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Stage 2: Final image
FROM python:3.10-slim-bookworm
WORKDIR /app

COPY backend/ ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers"]
