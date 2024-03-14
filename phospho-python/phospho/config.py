"""
Phospho internal configuration file
"""

import os

BASE_URL = "https://api.phospho.ai/v2"

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
COHERE_API_KEY = os.environ.get("COHERE_API_KEY")
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")

# Custom LLM provider setup
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", None)
MODEL_ID = os.environ.get("MODEL_ID", None)
