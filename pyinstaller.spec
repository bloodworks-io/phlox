# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all
import os

# Collect everything from chromadb
chromadb_datas, chromadb_binaries, chromadb_hiddenimports = collect_all('chromadb')

# Get the correct path to server.py
script_path = os.path.join(os.path.dirname(os.path.abspath(SPEC)), 'server', 'server.py')

a = Analysis(
    [script_path],  # Use absolute path to server.py
    pathex=[os.path.dirname(script_path)],  # Path to server directory
    binaries=chromadb_binaries,
    datas=chromadb_datas,
    hiddenimports=[
        "onnxruntime",
        "tokenizers",
        "tqdm",
    ] + chromadb_hiddenimports,
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
