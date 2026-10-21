"""Chat model interface of the agent, the reader and the grader.

Anything with a ``chat`` method returning :class:`ChatResult` works; :class:`OpenAIChatModel` talks to
any OpenAI-compatible endpoint (e.g. a local vLLM server). Errors are raised as exceptions; the agent
recognises an exceeded context window by the server's message ("maximum context length"), exactly as
the paper's runners do.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

Message = Dict[str, str]


@dataclass
class ChatResult:
    """One completion.

    Args:
        text: The message content (empty string when the server returned none).
        reasoning: Separate reasoning content, if the server returns one (used only when ``text`` is empty).
        finish_reason: ``"stop"``, ``"length"``, … (empty when unknown).
        prompt_tokens: Input tokens billed for this call.
        completion_tokens: Output tokens billed for this call.
    """

    text: str = ""
    reasoning: str = ""
    finish_reason: str = ""
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None


@runtime_checkable
class ChatModel(Protocol):
    """Minimal chat interface: one non-streaming completion per call."""

    def chat(self, messages: List[Message], *, max_tokens: int, temperature: float,
             frequency_penalty: float) -> ChatResult:  # pragma: no cover - protocol
        ...


class OpenAIChatModel:
    """OpenAI-compatible chat endpoint, configured as in the paper (greedy, reasoning disabled).

    Args:
        model: Served model name (paper: ``Qwen/Qwen3.5-122B-A10B`` as controller, reader and grader).
        base_url: Endpoint, e.g. a local vLLM server.
        api_key: Key for the endpoint; a local vLLM server accepts any value.
        timeout: Client timeout in seconds (paper: 7,200, no hidden retries).
        enable_thinking: Passed as ``chat_template_kwargs.enable_thinking`` (paper: ``False``).
        extra_body: Further fields merged into the request body (e.g. ``{"reasoning_effort": "low"}``).
    """

    def __init__(self, model: str = "Qwen/Qwen3.5-122B-A10B", base_url: str = "http://localhost:8000/v1",
                 api_key: str = "EMPTY", timeout: float = 7200.0, enable_thinking: bool = False,
                 extra_body: Optional[Dict[str, Any]] = None) -> None:
        from openai import OpenAI  # optional dependency, imported only when used

        self.model = model
        self.client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout, max_retries=0)
        self.extra_body: Dict[str, Any] = {"chat_template_kwargs": {"enable_thinking": enable_thinking}}
        if extra_body:
            self.extra_body.update(extra_body)

    def chat(self, messages: List[Message], *, max_tokens: int, temperature: float = 0.0,
             frequency_penalty: float = 0.0) -> ChatResult:
        resp = self.client.chat.completions.create(model=self.model, messages=messages, max_tokens=max_tokens,
                                                   temperature=temperature, frequency_penalty=frequency_penalty,
                                                   extra_body=self.extra_body)
        choice = resp.choices[0]
        msg = choice.message
        usage = resp.usage
        return ChatResult(text=msg.content or "", reasoning=getattr(msg, "reasoning_content", "") or "",
                          finish_reason=getattr(choice, "finish_reason", "") or "",
                          prompt_tokens=getattr(usage, "prompt_tokens", None) if usage is not None else None,
                          completion_tokens=getattr(usage, "completion_tokens", None) if usage is not None else None)
