# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Collect everything from chromadb
chromadb_datas, chromadb_binaries, chromadb_hiddenimports = collect_all('chromadb')

a = Analysis(
    ['server/server.py'],
    pathex=['server'],
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
    upx=True,
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
    upx=True,
    upx_exclude=[],
    name='server',
)
app = BUNDLE(
    coll,
    name='server.app',
    icon=None,
    bundle_identifier=None,
)
