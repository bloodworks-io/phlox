#!/usr/bin/env bash
# Overnight burn: all generation stages in dependency order. Resumable — rerun to continue.
set -u
cd "$(dirname "$0")/.."
export HF_HOME=/tmp/opencode/hf_cache
mkdir -p "$HF_HOME"
exec training/.venv/bin/python training/generate.py all
