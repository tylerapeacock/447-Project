#!/bin/bash
trap 'kill 0' EXIT

(cd backend/FastAPI && uvicorn mainAPI:app --reload --port 8000) &
(cd frontend && npm run dev) &

wait