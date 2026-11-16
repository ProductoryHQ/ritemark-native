"""A stand-in for the brotli module that fontTools' woff2 writer imports: Node's built-in zlib does the Brotli
compression (this Mac's Python brotli is an x86_64 build and won't load)."""
import subprocess

MODE_GENERIC, MODE_TEXT, MODE_FONT = 0, 1, 2

_JS = (
    "const z=require('zlib');const c=[];process.stdin.on('data',d=>c.push(d)).on('end',()=>{"
    "const b=Buffer.concat(c);const [op,mode,q]=process.argv.slice(1).map(Number);"
    "const out=op?z.brotliCompressSync(b,{params:{[z.constants.BROTLI_PARAM_MODE]:mode,[z.constants.BROTLI_PARAM_QUALITY]:q,"
    "[z.constants.BROTLI_PARAM_SIZE_HINT]:b.length}}):z.brotliDecompressSync(b);process.stdout.write(out)})"
)


def _run(data, *args):
    return subprocess.run(['node', '-e', _JS, *map(str, args)], input=bytes(data), capture_output=True, check=True).stdout


def compress(data, mode=MODE_GENERIC, quality=11, lgwin=22, lgblock=0):
    return _run(data, 1, mode, quality)


def decompress(data):
    return _run(data, 0, 0, 0)
