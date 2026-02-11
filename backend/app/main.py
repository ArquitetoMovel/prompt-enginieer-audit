from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Prompt Engineer Audit API",
    description="API for auditing code compliance using AI and MCP",
    version="0.1.0"
)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import audit

app.include_router(audit.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to Prompt Engineer Audit API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
