"""Retrieval-first ReAct agent: a seeded controller with an embedding search tool (the paper's §3.4).

A retrieval ranking (e.g. LatentGraphRAG's) becomes a :class:`Seed` of its top ten documents; the
:class:`ReActAgent` reads the seed, may search up to ten times, and answers with ``Exact Answer:``.
"""

from . import prompts
from .llm import ChatModel, ChatResult, OpenAIChatModel
from .prompts import POLICIES
from .react import ReActAgent, final_answer_text, shrink_observations
from .seed import Seed, SeedDoc
from .tools import (DenseSearchTool, Qwen3QueryEncoder, RankFileFusedSearchTool, SearchContext, SearchHit,
                    SearchResult, SearchTool)
from .trajectory import Step, Trajectory

__all__ = [
    "ReActAgent",
    "Seed",
    "SeedDoc",
    "Trajectory",
    "Step",
    "ChatModel",
    "ChatResult",
    "OpenAIChatModel",
    "SearchTool",
    "SearchContext",
    "SearchHit",
    "SearchResult",
    "DenseSearchTool",
    "RankFileFusedSearchTool",
    "Qwen3QueryEncoder",
    "POLICIES",
    "prompts",
    "final_answer_text",
    "shrink_observations",
]
