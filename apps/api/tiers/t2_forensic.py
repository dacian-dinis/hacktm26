"""Tier 2 image-forensics entry point."""

from __future__ import annotations

from typing import Any

from tiers.t2_ela import analyze_ela
from tiers.t2_maps import analyze_copy_move_heatmap, analyze_jpeg_grid_map
from tiers.t2_noise import analyze_noise_residual


def analyze_tier2(image_bytes: bytes) -> list[dict[str, Any]]:
    """Run all Tier 2 checks and return Finding-shaped dictionaries."""
    return [
        analyze_ela(image_bytes),
        analyze_noise_residual(image_bytes),
        analyze_copy_move_heatmap(image_bytes),
        analyze_jpeg_grid_map(image_bytes),
    ]
