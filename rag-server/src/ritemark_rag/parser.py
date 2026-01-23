"""Document parser using Docling.

Parses PDF, DOCX, PPTX, XLSX, and image files into structured text + metadata.
Output is JSON for consumption by the TypeScript extension.
"""

import json
import sys
from pathlib import Path
from typing import Any

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat


SUPPORTED_FORMATS = {
    ".pdf": InputFormat.PDF,
    ".docx": InputFormat.DOCX,
    ".pptx": InputFormat.PPTX,
    ".xlsx": InputFormat.XLSX,
    ".html": InputFormat.HTML,
    ".htm": InputFormat.HTML,
    ".png": InputFormat.IMAGE,
    ".jpg": InputFormat.IMAGE,
    ".jpeg": InputFormat.IMAGE,
    ".tiff": InputFormat.IMAGE,
    ".bmp": InputFormat.IMAGE,
}


def parse_document(file_path: str) -> dict[str, Any]:
    """Parse a document file and return structured text with metadata.

    Returns:
        {
            "source": "path/to/file.pdf",
            "format": "pdf",
            "pages": [...],
            "sections": [
                {
                    "title": "Section Title",
                    "content": "Section text content...",
                    "page": 1,
                    "level": 1
                }
            ],
            "tables": [...],
            "metadata": {
                "title": "Document Title",
                "page_count": 10
            }
        }
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format: {ext}. Supported: {list(SUPPORTED_FORMATS.keys())}")

    converter = DocumentConverter()
    result = converter.convert(str(path))
    doc = result.document

    sections = []
    tables = []

    for item in doc.iterate_items():
        element = item
        # Handle both tuple (item, level) and direct item access
        if isinstance(item, tuple):
            element = item[0]

        if hasattr(element, 'text') and element.text:
            section = {
                "content": element.text,
                "page": getattr(element.prov[0], 'page_no', None) if hasattr(element, 'prov') and element.prov else None,
            }

            # Detect section headers
            label = getattr(element, 'label', '')
            if 'heading' in str(label).lower() or 'title' in str(label).lower():
                section["title"] = element.text
                section["level"] = getattr(element, 'level', 1)
            else:
                section["title"] = None
                section["level"] = None

            sections.append(section)

        # Extract tables
        if hasattr(element, 'label') and 'table' in str(getattr(element, 'label', '')).lower():
            table_data = {
                "content": getattr(element, 'text', ''),
                "page": getattr(element.prov[0], 'page_no', None) if hasattr(element, 'prov') and element.prov else None,
            }
            tables.append(table_data)

    # Build full text for simple access
    full_text = doc.export_to_markdown()

    return {
        "source": str(path),
        "format": ext.lstrip('.'),
        "full_text": full_text,
        "sections": sections,
        "tables": tables,
        "metadata": {
            "title": getattr(doc, 'name', path.stem),
            "page_count": len(set(s.get("page") for s in sections if s.get("page") is not None)),
        }
    }


def main():
    """CLI entry point: parse a file and output JSON to stdout."""
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python parser.py <file_path>"}), file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        result = parse_document(file_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
