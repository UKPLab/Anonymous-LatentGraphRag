"""OpenAI-compatible chat completions client."""

from __future__ import annotations

import os
from typing import List, Optional

from latentgraphrag.llm.base import BaseLLM, ChatMessage
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


class CompatibleLLM(BaseLLM):
    """Calls an OpenAI-compatible Chat Completions endpoint via the openai SDK.

    Works with vLLM, local servers, and any OpenAI-compatible API (just point
    ``base_url`` at it).
    """

    def __init__(
        self,
        model: str,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.0,
        max_tokens: int = 512,
        timeout_s: float = 120.0,
    ) -> None:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "openai is required. Install with `pip install latentgraphrag[openai]`."
            ) from exc
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._client = OpenAI(
            api_key=api_key or os.environ.get("OPENAI_API_KEY"),
            base_url=base_url,
            timeout=timeout_s,
        )

    def complete(self, *, system: str, user: str, **kwargs) -> str:  # noqa: ARG002
        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return resp.choices[0].message.content or ""

    def complete_chat(self, messages: List[ChatMessage], **kwargs) -> str:  # noqa: ARG002
        """Pass the full message list through to the Chat Completions API verbatim.

        Used by the OpenIE pipeline for the paper-canonical few-shot prompts.
        """
        resp = self._client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            messages=[{"role": m["role"], "content": m["content"]} for m in messages],
        )
        return resp.choices[0].message.content or ""
