"""FastMCP server exposing RAG tools to Claude Code, Codex, Cursor etc.

Transport: stdio (launched as subprocess by the extension).
"""

import json
import sys
from pathlib import Path

from fastmcp import FastMCP

from .parser import parse_document, SUPPORTED_FORMATS

mcp = FastMCP("ritemark-rag")


@mcp.tool()
def parse_file(file_path: str) -> str:
    """Parse a document (PDF, Word, PowerPoint, Excel, image) into structured text.

    Returns JSON with sections, tables, and metadata.
    Used by the extension to index workspace documents.
    """
    try:
        result = parse_document(file_path)
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_supported_formats() -> str:
    """List all supported document formats for parsing."""
    formats = [{"extension": ext, "type": fmt.value} for ext, fmt in SUPPORTED_FORMATS.items()]
    return json.dumps(formats)


@mcp.tool()
def search_documents(query: str, workspace_path: str, top_k: int = 5) -> str:
    """Semantic search across all indexed documents in the workspace.

    Note: This tool delegates to the TypeScript extension's vector store.
    It reads the sqlite-vec database directly for MCP clients that
    don't have access to the extension's search API.
    """
    # This will be implemented to read from the sqlite-vec database directly
    # For now, return a placeholder that instructs the user
    return json.dumps({
        "note": "Search is handled by the extension's vector store. "
                "Use the extension's sidebar or wait for direct sqlite-vec access.",
        "query": query,
        "workspace": workspace_path,
        "top_k": top_k
    })


@mcp.tool()
def get_document_content(file_path: str, page: int | None = None) -> str:
    """Get the full extracted text content of a document or a specific page.

    Parses the document on-demand if not cached.
    """
    try:
        result = parse_document(file_path)
        if page is not None:
            # Filter sections for specific page
            page_sections = [s for s in result["sections"] if s.get("page") == page]
            return "\n\n".join(s["content"] for s in page_sections if s.get("content"))
        return result["full_text"]
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def list_supported_files(directory: str) -> str:
    """List all parseable files in a directory (recursive).

    Returns files that can be indexed (PDF, DOCX, PPTX, etc.)
    """
    dir_path = Path(directory)
    if not dir_path.is_dir():
        return json.dumps({"error": f"Not a directory: {directory}"})

    files = []
    for ext in SUPPORTED_FORMATS:
        for f in dir_path.rglob(f"*{ext}"):
            files.append({
                "path": str(f),
                "name": f.name,
                "format": ext.lstrip('.'),
                "size_bytes": f.stat().st_size,
            })

    return json.dumps(files, ensure_ascii=False)


def main():
    """Run the MCP server with stdio transport."""
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
