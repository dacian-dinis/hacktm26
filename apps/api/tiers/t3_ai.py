"""Tier 3: AI Signal (Probabilistic).

Uses a Vision Transformer (ViT) deepfake detector from Hugging Face.
Model: Wvolf/ViT_Deepfake_Detection
"""

from __future__ import annotations

import io
from PIL import Image
from transformers import pipeline

from models import Finding


# Global model cache
_detector = None


def _get_detector():
    global _detector
    if _detector is None:
        # Load the model. pipeline() handles downloading/caching.
        _detector = pipeline("image-classification", model="Wvolf/ViT_Deepfake_Detection")
    return _detector


async def analyze_t3_ai(image_bytes: bytes) -> Finding:
    """Analyze the image for deepfake signals.

    T3 is a probabilistic signal — never a verdict. `result` is ALWAYS
    `indeterminate`. The classifier's label + confidence go into evidence
    for the analyst to interpret alongside T1/T2/T4. This is enforced by
    the AGENTS.md rule: "Tier 3 must always be one signal, not a verdict."
    """
    try:
        detector = _get_detector()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        results = detector(image)
        # Results look like: [{'label': 'Real', 'score': 0.99}, {'label': 'Fake', 'score': 0.01}]
        results.sort(key=lambda x: x["score"], reverse=True)
        top = results[0]
        score = float(top["score"])

        # Confidence reflects the model's certainty, not whether the image
        # is real or fake. That distinction matters: "high confidence model
        # says real" is still NOT a verdict.
        if score > 0.9:
            confidence = "high"
        elif score > 0.7:
            confidence = "medium"
        else:
            confidence = "low"

        return Finding(
            tier=3,
            check="ai.deepfake.vit",
            result="indeterminate",
            confidence=confidence,
            evidence={
                "model": "Wvolf/ViT_Deepfake_Detection",
                "training_data": "FaceForensics++",
                "model_label": top["label"],
                "model_score": round(score, 4),
                "scores": {r["label"]: round(float(r["score"]), 4) for r in results},
                "note": (
                    "AI signal — one input among many. Not authoritative. "
                    "Trained on FaceForensics++, which covers face deepfakes "
                    "but not scene-level compositing. The analyst integrates "
                    "this with T1/T2/T4 to reach a verdict."
                ),
            },
            source="self",
            timestamp=Finding.now(),
        )
    except Exception as e:
        return Finding(
            tier=3,
            check="ai.deepfake.vit",
            result="indeterminate",
            confidence="low",
            evidence={"error": str(e), "note": "Failed to run AI classifier"},
            source="self",
            timestamp=Finding.now(),
        )
