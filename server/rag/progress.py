"""
SSE progress streaming for re-embedding operations.
"""

import asyncio
import contextlib
import json
import logging
from collections.abc import AsyncGenerator

from server.rag.vector_store import VECTOR_STORE_AVAILABLE, get_vector_store_manager

logger = logging.getLogger(__name__)

BATCH_SIZE = 100


def _sse(event: dict) -> str:
    """Format a dict as an SSE ``data:`` line."""
    return f"data: {json.dumps(event)}\n\n"


def _re_embed_collection_batched(vsm, collection_name, model_name, dim, progress_callback):
    """
    Re-embed a single collection, calling *progress_callback* after each batch.
    """
    chunk_texts = vsm.backend.get_chunk_texts(collection_name)
    if not chunk_texts:
        return 0

    chunk_ids = [t[0] for t in chunk_texts]
    texts = [t[1] for t in chunk_texts]
    total = len(texts)

    all_embeddings = []
    for i in range(0, total, BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        all_embeddings.extend(vsm.embedding_model(batch))
        embedded_so_far = min(i + BATCH_SIZE, total)
        if progress_callback:
            progress_callback(embedded_so_far, total)

    return vsm.backend.replace_embeddings(
        collection_name,
        model_name,
        dim,
        list(zip(chunk_ids, all_embeddings, strict=True)),
    )


async def stream_re_embed_progress() -> AsyncGenerator[str, None]:
    """
    Async generator yielding SSE events for re-embedding progress.
    """
    if not VECTOR_STORE_AVAILABLE:
        yield _sse({"type": "error", "message": "RAG features are not available"})
        return

    vsm = get_vector_store_manager()
    if vsm is None:
        yield _sse({"type": "error", "message": "Vector store not initialised"})
        return

    # Reload embedding function so a fresh EMBEDDING_MODEL config is picked up
    vsm._reload_embedding_function()

    collection_names = vsm.backend.list_collections()
    new_model = vsm._model_name
    new_dim = vsm.embedding_model.dimension

    # Pre-compute total chunk count for overall percentage
    collection_chunk_counts: dict[str, int] = {}
    total_chunks = 0
    for name in collection_names:
        chunk_texts = vsm.backend.get_chunk_texts(name)
        count = len(chunk_texts) if chunk_texts else 0
        collection_chunk_counts[name] = count
        total_chunks += count

    yield _sse(
        {
            "type": "start",
            "total_collections": len(collection_names),
            "total_chunks": total_chunks,
            "model_name": new_model,
        }
    )

    if not collection_names:
        yield _sse(
            {
                "type": "complete",
                "collections_processed": 0,
                "total_chunks_re_embedded": 0,
                "new_model": new_model,
                "new_dimension": new_dim,
            }
        )
        return

    total_embedded = 0

    for coll_idx, collection_name in enumerate(collection_names):
        coll_total = collection_chunk_counts[collection_name]

        yield _sse(
            {
                "type": "collection_start",
                "collection_name": collection_name,
                "collection_index": coll_idx,
                "total_collections": len(collection_names),
                "total_chunks_in_collection": coll_total,
            }
        )

        # Queue bridges the synchronous progress callback to the async generator
        queue: asyncio.Queue[dict] = asyncio.Queue()

        def _make_callback(ci, cn, ct, _total_embedded, _queue):
            def cb(embedded_in_coll, _total_in_coll):
                global_total = _total_embedded + embedded_in_coll
                pct = round(global_total / total_chunks * 100, 1) if total_chunks else 0
                with contextlib.suppress(RuntimeError):
                    asyncio.get_event_loop().call_soon_threadsafe(
                        _queue.put_nowait,
                        {
                            "type": "batch_progress",
                            "collection_name": cn,
                            "collection_index": ci,
                            "total_collections": len(collection_names),
                            "chunks_embedded": embedded_in_coll,
                            "total_chunks_in_collection": ct,
                            "total_embedded_so_far": global_total,
                            "total_chunks": total_chunks,
                            "percentage": pct,
                        },
                    )

            return cb

        callback = _make_callback(coll_idx, collection_name, coll_total, total_embedded, queue)

        task = asyncio.create_task(
            asyncio.to_thread(
                _re_embed_collection_batched,
                vsm,
                collection_name,
                new_model,
                new_dim,
                callback,
            )
        )

        # Relay progress events from the queue while the thread works
        while not task.done():
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.5)
                yield _sse(event)
            except TimeoutError:
                # Keepalive so proxies / load balancers don't kill the connection
                yield ": keepalive\n\n"

        # Drain any remaining events
        while not queue.empty():
            event = queue.get_nowait()
            yield _sse(event)

        # Check for exceptions from the thread
        try:
            count = task.result()
        except Exception as exc:
            logger.exception("Error re-embedding collection '%s'", collection_name)
            yield _sse(
                {
                    "type": "error",
                    "message": str(exc),
                    "collection_name": collection_name,
                }
            )
            return

        total_embedded += count

        yield _sse(
            {
                "type": "collection_complete",
                "collection_name": collection_name,
                "collection_index": coll_idx,
                "chunks_re_embedded": count,
            }
        )

    yield _sse(
        {
            "type": "complete",
            "collections_processed": len(collection_names),
            "total_chunks_re_embedded": total_embedded,
            "new_model": new_model,
            "new_dimension": new_dim,
        }
    )
