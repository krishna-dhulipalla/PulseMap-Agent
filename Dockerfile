# ---------- Stage 1: build the React app ----------
FROM node:20-alpine AS webbuilder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build

# ---------- Stage 2: Python runtime ----------
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860 \
    DATA_DIR=/data
WORKDIR /app

ENV PORT=7860 DATA_DIR=/data

RUN mkdir -p /data/uploads

# (optional) if you hit build issues with some libs
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

# Copy backend and install deps
COPY backend ./backend
# Use a simple requirements file for predictability
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy built frontend into /app/web/dist so FastAPI can serve it
COPY --from=webbuilder /web/dist ./web/dist

# Prepare data dir for sqlite + uploads
RUN mkdir -p ${DATA_DIR}/uploads
VOLUME ["/data"]

# Spaces require a single port—expose default; they’ll pass $PORT
EXPOSE 7860

# Start FastAPI bound to Spaces' $PORT
CMD ["bash","-lc","uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
