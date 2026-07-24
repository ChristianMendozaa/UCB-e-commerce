from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from app.services.rag_service import process_upload
from app.services.agent_service import run_agent

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in ["text/plain", "application/octet-stream"]:
        raise HTTPException(400, "Solo archivos .txt")

    content = await file.read()
    if len(content) > 2_000_000:
        raise HTTPException(413, "Archivo demasiado grande (máx 2 MB).")

    try:
        result = process_upload(content)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error interno: {str(e)}")

@router.post("/chat")
async def chat(request: Request, payload: dict):
    question = payload.get("question")
    history = payload.get("history", [])
    current_page = payload.get("current_page", "/")
    
    if not question:
        raise HTTPException(400, "Falta 'question'")

    # Extraer cookies para pasarlas al agente
    cookies = request.cookies

    try:
        # Ejecutar el agente con contexto de página
        result = await run_agent(question, cookies, history, current_page)
        return result
    except Exception as e:
        print(f"Error en chat: {e}")
        raise HTTPException(500, f"Error interno: {str(e)}")
