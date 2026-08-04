"""vLLM offline client for OpenIE.

Offline vLLM is the right choice when you want full control over batching and prefix
caching for the few-shot prompts used by the OpenIE pipeline. The system + 1-shot demo
+ user template is the same across thousands of chunks; prefix caching makes the
re-encoding nearly free.

Supports both single-call (``complete``/``complete_chat``) and batched
(``batch_complete_chat``) inference. The graph builder uses the batched path so
indexing a large corpus is one batched vLLM call per OpenIE stage (NER, then triples)
rather than 2N sequential calls.
"""

from __future__ import annotations

import os
from typing import List, Optional

from latentgraphrag.llm.base import BaseLLM, ChatMessage
from latentgraphrag.utils.logging import get_logger

logger = get_logger(__name__)


class VLLMOffline(BaseLLM):
    """Self-hosted offline vLLM client.

    Example::

        from latentgraphrag.llm.vllm import VLLMOffline
        llm = VLLMOffline("meta-llama/Llama-3.3-70B-Instruct", gpu_memory_utilization=0.8)
        rag = LatentGraphRAG(openie_llm=llm, verbalizer_llm=llm)
    """

    def __init__(
        self,
        model: str = "meta-llama/Llama-3.3-70B-Instruct",
        *,
        tensor_parallel_size: Optional[int] = None,
        pipeline_parallel_size: int = 1,
        max_model_len: int = 4096,
        gpu_memory_utilization: float = 0.6,
        temperature: float = 0.0,
        max_tokens: int = 2048,
        quantization: Optional[str] = None,
        load_format: Optional[str] = None,
        seed: int = 0,
        enable_prefix_caching: bool = True,
        enforce_eager: bool = False,
        trust_remote_code: bool = True,
    ) -> None:
        try:
            import torch
            from vllm import LLM, SamplingParams
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "vLLM is required. Install with `pip install latentgraphrag[vllm]`."
            ) from exc

        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

        # Sensible defaults: use all visible CUDA devices unless told otherwise.
        if tensor_parallel_size is None:
            tensor_parallel_size = max(torch.cuda.device_count(), 1)
        # bitsandbytes-quantized models can't tensor-parallelize cleanly.
        if quantization == "bitsandbytes":
            tensor_parallel_size = 1
            load_format = load_format or "bitsandbytes"

        # vLLM expects spawn for multi-GPU.
        os.environ.setdefault("VLLM_WORKER_MULTIPROC_METHOD", "spawn")

        logger.info(
            "Loading vLLM offline: model=%s tp=%s mem_util=%s max_len=%s",
            model,
            tensor_parallel_size,
            gpu_memory_utilization,
            max_model_len,
        )
        self._client = LLM(
            model=model,
            tensor_parallel_size=tensor_parallel_size,
            pipeline_parallel_size=pipeline_parallel_size,
            seed=seed,
            dtype="auto",
            max_seq_len_to_capture=max_model_len,
            max_model_len=max_model_len,
            enable_prefix_caching=enable_prefix_caching,
            enforce_eager=enforce_eager,
            gpu_memory_utilization=gpu_memory_utilization,
            quantization=quantization,
            load_format=load_format or "auto",
            trust_remote_code=trust_remote_code,
        )
        self._tokenizer = self._client.get_tokenizer()
        self._SamplingParams = SamplingParams

    # ------------------------------------------------------------------ helpers

    def _format(self, messages: List[ChatMessage]) -> str:
        return self._tokenizer.apply_chat_template(
            conversation=messages,
            tokenize=False,
            add_generation_prompt=True,
        )

    def _sampling(self):
        return self._SamplingParams(
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )

    # ------------------------------------------------------------------ BaseLLM

    def complete(self, *, system: str, user: str, **kwargs) -> str:  # noqa: ARG002
        return self.complete_chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ]
        )

    def complete_chat(self, messages: List[ChatMessage], **kwargs) -> str:  # noqa: ARG002
        prompt = self._format(messages)
        out = self._client.generate(prompts=[prompt], sampling_params=self._sampling())
        return out[0].outputs[0].text

    def batch_complete_chat(
        self, messages_list: List[List[ChatMessage]], **kwargs
    ) -> List[str]:  # noqa: ARG002
        """Batch many chat-message lists in a single vLLM call.

        This is where the speedup lives. Prefix caching means the few-shot demo prefix
        is encoded once and reused across the entire batch.
        """
        prompts = [self._format(m) for m in messages_list]
        outputs = self._client.generate(prompts=prompts, sampling_params=self._sampling())
        return [o.outputs[0].text for o in outputs]
