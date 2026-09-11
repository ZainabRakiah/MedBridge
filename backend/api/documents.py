"""MedBridge — Document upload and extraction API."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from models.patient import MedicalDocument
from services.document_extraction_service import process_uploaded_document

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("/extract", response_model=MedicalDocument)
async def extract_document(
    file: UploadFile = File(...),
    patient_id: str = Form("demo_patient"),
):
    """Upload a medical document (PDF/image) and extract structured clinical data.
    
    Supported formats: PDF, JPG, PNG, HEIC, WebP.
    Maximum file size: 20MB.
    
    Returns extracted medications, diagnoses, lab results, allergies with confidence scores.
    All extracted data requires human verification before clinical use.
    """
    contents = await file.read()
    mime_type = file.content_type or "application/octet-stream"

    try:
        doc = await process_uploaded_document(
            file_bytes=contents,
            filename=file.filename or "document",
            mime_type=mime_type,
            patient_id=patient_id,
        )
        return doc
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")
