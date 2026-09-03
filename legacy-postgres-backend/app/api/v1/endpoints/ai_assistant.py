from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.deps import get_current_business
from app.core.config import settings
from app.models.business import Business
from app.schemas.ai_assistant import AIStatusOut, ProductContentOut, ProductContentRequest
from app.services.ai_provider import ProductContentRequest as ProviderRequest, get_ai_provider

router = APIRouter(prefix="/ai", tags=["ai-assistant"])


@router.get("/status", response_model=AIStatusOut)
def ai_status(business: Business = Depends(get_current_business)):
    provider = get_ai_provider()
    configured = provider.is_configured()
    return AIStatusOut(
        configured=configured,
        provider=settings.AI_PROVIDER,
        message=(
            "AI Assistant is ready."
            if configured
            else "AI Assistant needs to be configured by the platform admin (set AI_PROVIDER and AI_API_KEY). "
                 "Once connected, you'll be able to generate product titles, descriptions, tags and social captions here."
        ),
    )


@router.post("/generate-product-content", response_model=ProductContentOut)
def generate_product_content(payload: ProductContentRequest, business: Business = Depends(get_current_business)):
    provider = get_ai_provider()
    if not provider.is_configured():
        raise HTTPException(
            status_code=503,
            detail="AI Assistant is not configured yet. Ask your platform admin to set up an AI provider.",
        )
    try:
        result = provider.generate_product_content(ProviderRequest(
            product_name=payload.product_name, category=payload.category, keywords=payload.keywords,
        ))
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    return ProductContentOut(
        title=result.title, description=result.description, tags=result.tags, social_caption=result.social_caption,
    )
