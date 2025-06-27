"""
Shared embedding functions for the Phlox server.
"""

from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
from typing import Union, cast
from server.utils.llm_client import LocalModelManager


class LocalEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    Local embedding function using llama-cpp-python for generating embeddings.
    """

    def __init__(self, model_name: str, models_dir: str = None):
        """
        Initialize the Local Embedding Function.

        Args:
            model_name (str): The name of the model to use for embeddings.
            models_dir (str): Directory where models are stored.
        """
        self.model_name = model_name
        self.model_manager = LocalModelManager(models_dir)
        self._llm = None

    def _ensure_model_loaded(self):
        """Ensure the embedding model is loaded."""
        if self._llm is None:
            try:
                from llama_cpp import Llama
            except ImportError:
                raise ImportError(
                    "llama-cpp-python not installed. Install with appropriate backend support."
                )

            model_path = self.model_manager.get_model_path(self.model_name)
            if not model_path.exists():
                raise FileNotFoundError(
                    f"Model '{self.model_name}' not found. Please download it first."
                )

            # Load model with embedding=True for embedding generation
            self._llm = Llama(
                model_path=str(model_path),
                embedding=True,
                verbose=False,
                n_ctx=512,  # Smaller context for embeddings
            )

    def __call__(self, input: Union[Documents, str]) -> Embeddings:
        """
        Get the embeddings for a list of texts.

        Args:
            input (Documents): A list of texts to get embeddings for.

        Returns:
            Embeddings: The embeddings for the texts.
        """
        self._ensure_model_loaded()

        # Convert single string to list
        texts = input if isinstance(input, list) else [input]

        # Generate embeddings for each text
        embeddings = []
        for text in texts:
            # Create embedding using llama-cpp-python
            embedding = self._llm.create_embedding(text)
            # Extract the embedding data
            if isinstance(embedding, dict) and "data" in embedding:
                # Handle OpenAI-style response format
                embeddings.append(embedding["data"][0]["embedding"])
            elif isinstance(embedding, list):
                # Handle direct list format
                embeddings.append(
                    embedding[0] if len(embedding) > 0 else embedding
                )
            else:
                # Handle other formats
                embeddings.append(embedding)

        return cast(Embeddings, embeddings)


__all__ = ["LocalEmbeddingFunction"]
