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
    """Analyze the image for deepfake signals."""
    try:
        detector = _get_detector()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        results = detector(image)
        # Results look like: [{'label': 'Real', 'score': 0.99}, {'label': 'Fake', 'score': 0.01}]
        
        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)
        top = results[0]
        
        label = top["label"].lower()
        score = top["score"]
        
        # Map label to Result
        if label == "real":
            result = "pass"
        elif label == "fake":
            result = "fail"
        else:
            result = "indeterminate"
            
        # Map score to Confidence
        if score > 0.9:
            confidence = "high"
        elif score > 0.7:
            confidence = "medium"
        else:
            confidence = "low"
            
        return Finding(
            tier=3,
            check="ai.deepfake.vit",
            result=result,
            confidence=confidence,
            evidence={
                "model": "Wvolf/ViT_Deepfake_Detection",
                "scores": {r["label"]: r["score"] for r in results},
                "training_data": "FaceForensics++",
                "note": "AI signal — one input among many. Not authoritative. Trained on FaceForensics++.",
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
