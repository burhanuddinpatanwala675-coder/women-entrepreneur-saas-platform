"""AI Assistant provider interface.

This is architecture, not a mock: if no provider is configured, endpoints return a
clear "not configured" response instead of fabricating AI output. Wiring up a real
provider is a matter of implementing one more subclass and setting AI_PROVIDER/AI_API_KEY —
no endpoint or frontend code needs to change.
"""
import abc
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings


@dataclass
class ProductContentRequest:
    product_name: Optional[str]
    category: Optional[str]
    keywords: Optional[str]
    tone: Optional[str] = "warm and friendly"


@dataclass
class ProductContentResult:
    title: str
    description: str
    tags: list
    social_caption: str


class AIProvider(abc.ABC):
    @abc.abstractmethod
    def is_configured(self) -> bool:
        raise NotImplementedError

    @abc.abstractmethod
    def generate_product_content(self, req: ProductContentRequest) -> ProductContentResult:
        raise NotImplementedError


class NullAIProvider(AIProvider):
    """Used when AI_PROVIDER=none. Every call raises clearly rather than returning
    fake content, per the platform's development rules."""

    def is_configured(self) -> bool:
        return False

    def generate_product_content(self, req: ProductContentRequest) -> ProductContentResult:
        raise RuntimeError(
            "AI Assistant is not configured yet. Set AI_PROVIDER and AI_API_KEY in your "
            "environment to enable AI-generated product content."
        )


class OpenAIProvider(AIProvider):
    """Real implementation placeholder — wire up the `openai` SDK here once a key is
    provided. Left unimplemented (not faked) until real credentials exist."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_product_content(self, req: ProductContentRequest) -> ProductContentResult:
        raise NotImplementedError(
            "OpenAIProvider is scaffolded but not yet implemented. Install the openai "
            "package and implement this method to enable live generation."
        )


def get_ai_provider() -> AIProvider:
    if settings.AI_PROVIDER == "openai" and settings.AI_API_KEY:
        return OpenAIProvider(settings.AI_API_KEY)
    return NullAIProvider()
