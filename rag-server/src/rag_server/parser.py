#!/usr/bin/env python3
"""
Docling-based document parser for RiteMark RAG.

Usage:
    python -m rag_server.parser <file_path>

Outputs JSON to stdout:
{
    "text": "extracted text content",
    "metadata": {
        "type": "pdf|docx|pptx|image",
        "pages": 10,
        "title": "Document Title",
        "author": "Author Name"
    },
    "pages": [
        {"page": 1, "text": "page 1 content"},
        {"page": 2, "text": "page 2 content"}
    ]
}
"""

import json
import sys
from pathlib import Path


def parse_with_docling(file_path: str) -> dict:
    """Parse a document using Docling."""
    from docling.document_converter import DocumentConverter

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    # Determine document type from extension
    ext = path.suffix.lower()
    doc_type_map = {
        ".pdf": "pdf",
        ".docx": "docx",
        ".pptx": "pptx",
        ".png": "image",
        ".jpg": "image",
        ".jpeg": "image",
        ".tiff": "image",
        ".bmp": "image",
    }
    doc_type = doc_type_map.get(ext, "unknown")

    if doc_type == "unknown":
        raise ValueError(f"Unsupported file type: {ext}")

    # Create converter and process document
    converter = DocumentConverter()
    result = converter.convert(file_path)
    doc = result.document

    # Extract text from all pages
    pages = []
    full_text_parts = []

    # Docling returns content as a list of elements with page info
    current_page = 1
    current_page_text = []

    for element in doc.iterate_items():
        item = element[1]  # (path, item) tuple

        # Get text content
        text = ""
        if hasattr(item, "text"):
            text = item.text
        elif hasattr(item, "export_to_markdown"):
            text = item.export_to_markdown()

        if not text:
            continue

        # Track page number if available
        page_num = current_page
        if hasattr(item, "prov") and item.prov:
            for prov in item.prov:
                if hasattr(prov, "page_no"):
                    page_num = prov.page_no
                    break

        # Handle page transitions
        if page_num != current_page:
            if current_page_text:
                pages.append({"page": current_page, "text": "\n\n".join(current_page_text)})
            current_page = page_num
            current_page_text = []

        current_page_text.append(text)
        full_text_parts.append(text)

    # Add final page
    if current_page_text:
        pages.append({"page": current_page, "text": "\n\n".join(current_page_text)})

    # Extract metadata
    metadata = {
        "type": doc_type,
        "pages": len(pages) if pages else 1,
    }

    # Try to get document metadata
    if hasattr(doc, "origin") and doc.origin:
        if hasattr(doc.origin, "title") and doc.origin.title:
            metadata["title"] = doc.origin.title

    # Build full text
    full_text = "\n\n".join(full_text_parts)

    # Clean up text
    full_text = full_text.replace("\r\n", "\n")
    full_text = "\n".join(line.strip() for line in full_text.split("\n"))
    while "\n\n\n" in full_text:
        full_text = full_text.replace("\n\n\n", "\n\n")
    full_text = full_text.strip()

    return {
        "text": full_text,
        "metadata": metadata,
        "pages": pages,
    }


def main():
    """CLI entry point."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python -m rag_server.parser <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        result = parse_with_docling(file_path)
        print(json.dumps(result))
    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
    except ImportError as e:
        print(json.dumps({
            "error": "Docling not installed. Run: pip install docling",
            "details": str(e),
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "error": f"Failed to parse document: {str(e)}",
            "type": type(e).__name__,
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
