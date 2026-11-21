"""
Embedding service for Statesmen AI.

Serves Qwen3-Embedding-0.6B on Modal with Hugging Face Text Embeddings
Inference (TEI). Exposes an OpenAI-compatible endpoint at /v1/embeddings
(plus TEI's native /embed), protected by a bearer API key.

Deploy:   modal deploy infra/embed.py
Secret:   modal secret create statesmen-embed-key API_KEY=<random>
"""

import os
import subprocess

import modal

MODEL_ID = "Qwen/Qwen3-Embedding-0.6B"
PORT = 8000
# "86-" builds target Ampere A10G GPUs. Qwen3 support landed in TEI 1.7.2.
TEI_IMAGE = "ghcr.io/huggingface/text-embeddings-inference:86-1.9.4"
MODEL_CACHE = "/models"

image = modal.Image.from_registry(TEI_IMAGE, add_python="3.12").entrypoint([])
models = modal.Volume.from_name("statesmen-embed-models", create_if_missing=True)

app = modal.App("statesmen-embed")


@app.function(
    image=image,
    # Not L4: deployed L4 endpoints never restarted after their first
    # container shut down (tested 2026-11-21). A10G and T4 restarted in ~5s.
    gpu="A10G",
    volumes={MODEL_CACHE: models},
    secrets=[modal.Secret.from_name("statesmen-embed-key")],
    # Shut down after 5 idle minutes so we only pay while in use.
    scaledown_window=300,
    timeout=600,
)
@modal.concurrent(max_inputs=32)
@modal.web_server(port=PORT, startup_timeout=300)
def serve() -> None:
    subprocess.Popen(
        [
            "text-embeddings-router",
            "--model-id", MODEL_ID,
            "--hostname", "0.0.0.0",
            "--port", str(PORT),
            "--huggingface-hub-cache", MODEL_CACHE,
            "--api-key", os.environ["API_KEY"],
            # Truncate over-long inputs instead of rejecting them.
            "--auto-truncate",
        ]
    )
