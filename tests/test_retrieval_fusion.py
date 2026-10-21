import math

import pytest

from latentgraphrag import fuse, project, rank

SOURCES = {0: ["a"], 1: ["a", "b"], 2: ["c"], 3: None}
SCORES = {0: 0.5, 1: 0.2, 2: 0.4, 3: 0.9}


def test_projection_max_sum_mean():
    assert project(SCORES, SOURCES, "max") == {"a": 0.5, "b": 0.2, "c": 0.4}
    assert project(SCORES, SOURCES, "sum") == pytest.approx({"a": 0.7, "b": 0.2, "c": 0.4})
    assert project(SCORES, SOURCES, "mean") == pytest.approx({"a": 0.35, "b": 0.2, "c": 0.4})


def test_projection_soft_max_and_noisy_or():
    assert project(SCORES, SOURCES, "pmax2")["a"] == pytest.approx(math.sqrt(0.5 ** 2 + 0.2 ** 2))
    assert project(SCORES, SOURCES, "pmax4")["a"] == pytest.approx((0.5 ** 4 + 0.2 ** 4) ** 0.25)
    assert project(SCORES, SOURCES, "noisy_or")["a"] == pytest.approx(1 - 0.5 * 0.8)


def test_unit_without_source_is_dropped_and_bad_reducer_rejected():
    assert "None" not in project(SCORES, SOURCES)
    with pytest.raises(ValueError):
        project(SCORES, SOURCES, "median")


D = {"a": 0.6, "b": 0.3}
M = {"b": 0.4, "c": 0.2}


def test_combmnz_and_combsum():
    assert fuse([D, M], [1.0, 0.5], "combmnz") == pytest.approx({"a": 0.6, "b": (0.3 + 0.2) * 2, "c": 0.1})
    assert fuse([D, M], [1.0, 0.5], "combsum") == pytest.approx({"a": 0.6, "b": 0.5, "c": 0.1})


def test_rrf_ranks_start_at_one():
    out = fuse([D, M], [1.0, 0.5], "rrf", rrf_k=60)
    assert out["a"] == pytest.approx(1 / 61)
    assert out["b"] == pytest.approx(1 / 62 + 0.5 / 61)
    assert out["c"] == pytest.approx(0.5 / 62)


def test_z_imputes_missing_with_view_minimum():
    out = fuse([D, M], [1.0, 1.0], "z")
    sd_d = math.sqrt(((0.6 - 0.45) ** 2 + (0.3 - 0.45) ** 2) / 1)
    sd_m = math.sqrt(((0.4 - 0.3) ** 2 + (0.2 - 0.3) ** 2) / 1)
    z_d = {"a": 0.15 / sd_d, "b": -0.15 / sd_d}
    z_m = {"b": 0.1 / sd_m, "c": -0.1 / sd_m}
    assert out["a"] == pytest.approx(z_d["a"] + min(z_m.values()))
    assert out["c"] == pytest.approx(min(z_d.values()) + z_m["c"])


def test_max_ignores_weights_and_rank_is_stable():
    assert fuse([D, M], [1.0, 0.0], "max") == {"a": 0.6, "b": 0.4, "c": 0.2}
    assert rank({"x": 1.0, "y": 2.0, "z": 1.0}) == ["y", "x", "z"]
    assert rank({"x": 1.0, "y": 2.0}, k=1) == ["y"]
