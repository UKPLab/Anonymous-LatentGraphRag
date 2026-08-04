"""LLM provider abstraction."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, TypedDict


class ChatMessage(TypedDict):
    role: str  # "system" | "user" | "assistant"
    content: str


class BaseLLM(ABC):
    """Minimal LLM interface used by OpenIE + verbalizer.

    Two entry points:

    - ``complete(system, user)`` — single-turn convenience for the verbalizer.
    - ``complete_chat(messages)`` — full chat-message list for the few-shot OpenIE
      prompts that the paper experiments use.

    Subclasses may implement either or both; the default ``complete_chat`` falls back
    to flattening the messages into a single user prompt routed through ``complete``.
    """

    @abstractmethod
    def complete(self, *, system: str, user: str, **kwargs) -> str:
        """Return a single completion string for the given system + user prompts."""

    def complete_chat(self, messages: List[ChatMessage], **kwargs) -> str:
        """Default: flatten ``messages`` into a single system + user prompt.

        Real chat-capable providers (OpenAI, vLLM) should override this to send the
        full message list — that's required to make few-shot prompts work correctly.
        """
        system = ""
        user_parts: List[str] = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system" and not system:
                system = content
            else:
                user_parts.append(f"[{role}]\n{content}")
        user = "\n\n".join(user_parts)
        return self.complete(system=system, user=user, **kwargs)

    def batch_complete_chat(
        self, messages_list: List[List[ChatMessage]], **kwargs
    ) -> List[str]:
        """Process a list of message lists. Default: a sequential loop.

        vLLM should override this to issue one batched ``generate`` call so prefix
        caching can amortize the few-shot prompt across the batch.
        """
        return [self.complete_chat(m, **kwargs) for m in messages_list]


class EchoLLM(BaseLLM):
    """Deterministic LLM that echoes the user prompt. Used for tests and demos."""

    def complete(self, *, system: str, user: str, **kwargs) -> str:  # noqa: ARG002
        return user
