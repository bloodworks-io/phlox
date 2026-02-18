import logging

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()


@router.get("/validate-url")
async def validate_url(
    url: str = Query(..., description="URL to validate"),
    type: str = Query(
        ..., description="Type of URL (whisper, ollama, or openai)"
    ),
):
    """Validate if a URL is accessible and returns a valid response."""
    try:
        async with httpx.AsyncClient() as client:
            if type == "whisper":
                # For Whisper, try to access the audio/transcriptions endpoint with a minimal request
                validate_url = f"{url}/v1/audio/transcriptions"

                # Prepare a minimal form data with empty file
                headers = {}
                form_data = {"model": "whisper-1"}
                try:
                    response = await client.post(
                        validate_url,
                        data=form_data,
                        headers=headers,
                        timeout=3.0,
                    )

                    # If we get a 400, it means the endpoint exists but our request was invalid (which is expected)
                    # Or if we get a 401, it means the endpoint exists but requires authentication
                    # Or if we get a 422, it means the endpoint exists but our request was invalid (which is expected)
                    if response.status_code in [400, 401, 403, 422]:
                        return {"valid": True}
                    elif response.status_code == 200:
                        return {"valid": True}
                    else:
                        return {
                            "valid": False,
                            "status_code": response.status_code,
                        }
                except Exception as e:
                    # If we get a connection error, the URL might be wrong
                    logging.error(f"Error validating Whisper URL: {str(e)}")
                    return {
                        "valid": False,
                        "error": "An internal error has occurred while validating the URL.",
                    }
            elif type == "ollama":
                # For Ollama, try to access the tags endpoint
                validate_url = f"{url}/api/tags"
                response = await client.get(validate_url, timeout=3.0)
                return {"valid": response.status_code == 200}
            elif type == "openai":
                # For OpenAI-compatible, try to access the models endpoint
                validate_url = f"{url}/v1/models"
                try:
                    response = await client.get(validate_url, timeout=3.0)
                    # Most OpenAI-compatible endpoints will return 401 without auth
                    return {
                        "valid": response.status_code in [200, 401, 403, 404]
                    }
                except:
                    # If models endpoint doesn't exist, try a different endpoint
                    validate_url = f"{url}/v1/chat/completions"
                    try:
                        response = await client.post(
                            validate_url,
                            json={"model": "test", "messages": []},
                            timeout=3.0,
                        )
                        return {
                            "valid": response.status_code
                            in [200, 401, 403, 404, 422]
                        }
                    except:
                        return {"valid": False}
            else:
                raise HTTPException(status_code=400, detail="Invalid URL type")

    except Exception as e:
        logging.error(f"Error validating URL: {str(e)}")
        return {
            "valid": False,
            "error": "An internal error has occurred while validating the URL.",
        }
