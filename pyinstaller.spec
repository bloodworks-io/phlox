# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs
import os

# Collect everything from chromadb
chromadb_datas, chromadb_binaries, chromadb_hiddenimports = collect_all('chromadb')

# Collect llama-cpp-python binaries and data
llama_cpp_datas, llama_cpp_binaries, llama_cpp_hiddenimports = collect_all('llama_cpp')

# Collect dynamic libraries for llama-cpp-python
llama_cpp_dynamic_libs = collect_dynamic_libs('llama_cpp')

# Get the correct path to server.py
script_path = os.path.join(os.path.dirname(os.path.abspath(SPEC)), 'server', 'server.py')

a = Analysis(
    [script_path],
    pathex=[os.path.dirname(script_path)],
    binaries=chromadb_binaries + llama_cpp_binaries + llama_cpp_dynamic_libs,
    datas=chromadb_datas + llama_cpp_datas,
    hiddenimports=[
        "onnxruntime",
        "tokenizers",
        "tqdm",
        "llama_cpp",
        "llama_cpp.llama_cpp",
        "llama_cpp.llama",
        "_ctypes",  # Often needed for ctypes-based libraries
    ] + chromadb_hiddenimports + llama_cpp_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='server'
)
