#!/usr/bin/env python3
"""Build the fictional G1 workspace and its sibling facts.json under <out-dir>."""

import argparse
import importlib
import json
import secrets
import shutil
import sys
import tempfile
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

NAME = 'Fernhollow Bank review'
SHARED = Path('/Users/Shared/Ritemark') / NAME
PROTECTED = '04 Drafts/Confidential appendix.docx'
DECK = '04 Drafts/Decision briefing.pptx'

# Fact phrases apply to both the shared set and the generated equivalent.
BASE = [
    ('01 Brief/Engagement brief.docx', 'IT systems and the mortgage centre are outside the scope.',
     ['mortgage centre', 'mortgage center', 'it systems', '31%', '31 percent',
      'call volumes rose', 'calls rose', '12 interviews', 'twelve interviews',
      'two workshops', '2 workshops', 'branches in three sizes', 'first 90 days',
      'staffing numbers are indicative', 'headcount plan']),
    ('02 Interviews/Interview – branch manager, Riverside.docx',
     'Riverside receives about 140 visits a day, with queues peaking on Mondays.',
     ['140 visits', 'mondays', 'after the 25th', 'paying bills', 'bill payments',
      'conversation, not the transaction', 'quiet room for advice', 'fewer counters',
      'two hours', '2 hours', 'paperwork']),
    ('02 Interviews/Interview – customer service lead.docx',
     'Calls about card disputes doubled after the May app change.',
     ['card disputes', 'card-dispute', 'may app change', 'app change in may', 'escalation path',
      'call notes', 'shared case view', 'hand-offs', 'handoffs']),
    ('02 Interviews/Interview – head of operations.docx',
     'A visit costs €18.40, compared with €3.10 for a call.',
     ['18.40', '18.4', '3.10', '3.1', '11 years old', 'eleven years old', 'complaints last',
      'complaints for a year', 'complaints for a month', 'six smallest branches', '6 smallest branches', 'post office']),
    ('02 Interviews/Interview – two tellers, Harbour Street.docx',
     'The tellers suggest an app desk near the door.',
     ["app desk near the door", "app desk' near the door", 'app desk by the door', 'app desk at the entrance',
      'lunchtime', 'lunch hour', 'questions about the app', 'app questions', 'review means closures', 'fear closures']),
    ('03 Workshop/Workshop notes 14 October.docx',
     'Small branches could share one manager.',
     ['share one manager', 'shared manager', 'share a manager', 'twelve branch managers', '12 branch managers',
      'two facilitators', '2 facilitators', 'three hours', '3 hours', 'advice, not transactions',
      'app pushes people to branches', 'app fails', 'app desk at the door', '9 votes', '7 votes', '4 votes',
      'evening opening', 'open in the evening']),
    ('04 Drafts/Findings draft v2.docx',
     'Older customers rely on branches for help with the app.',
     ['six times', '6 times', '6x', 'rely on branches for help with the app', 'case notes', 'end of their life',
      'staff want to be told early', 'longer visits', 'visits are longer', 'transactions that have moved to the app']),
    ('04 Drafts/Proposal phase 2 v3.docx',
     'The twelve-week phase will cost €79,000 plus VAT.',
     ['79,000', '79000', '79 000', '79k', 'twelve-week', '12-week', 'twelve weeks', '12 weeks',
      'design with staff', 'three branch sizes', 'app desk in two branches', 'app desk in 2 branches',
      'two-branch', 'four-week pilot', '4-week pilot', 'first moves', 'business case',
      '38,000', '22,000', '19,000', '38000', '22000', '19000', '38k', '22k', '19k',
      '31 december', 'december 31']),
    ('Steering group minutes 21 October.docx',
     'Operations will provide cost per visit by branch by 4 November.',
     ['4 november', 'november 4', 'nov 4', 'cost per visit by branch', '18 november', 'november 18', 'nov 18',
      '11 november', 'november 11', 'nov 11', "board's decision", 'board decision', 'board approval',
      'told in december', 'staff in december', 'december announcement', 'head of retail']),
    ('Reference/Annual report 2025, branch section.pdf',
     'At year end the bank ran 42 branches and 118 cash machines.',
     ['118 cash machines', '118 atms', '2.1 million', '2.6 million', '87%', '87 percent',
      'reviewed in 2026', '2026 review', 'march 2027']),
    ('Reference/Branch visit form, Riverside (scan).pdf',
     'At 12:10 there were nine people in the queue. Only two of four counters were open.',
     ['12:10', 'nine people', '9 people', 'two of four counters', '2 of 4 counters', 'counters open: 2 of 4',
      'advice room', 'out of order', '9 oct 2026', '9 october 2026', 'october 9']),
]

# Notes are deliberately distinct from the slide text and from one another.
SLIDES = [
    ('Pilot scope', 'Start with three branch types.', 'Use the amber ledger for the pilot register.',
     ['three branch types', '3 branch types'], ['amber ledger']),
    ('Advice', 'Reserve the quiet room on Tuesdays.', 'Test the queue buzzer before opening.',
     ['tuesday', 'tuesdays'], ['queue buzzer']),
    ('Access', 'Keep the west entrance open.', 'Place the folding ramp by the side door.',
     ['west entrance'], ['folding ramp']),
    ('Staffing', 'Train eight advisers first.', 'Use the mock till during rehearsal.',
     ['eight advisers', '8 advisers'], ['mock till']),
    ('Budget', 'Keep €6,200 in reserve.', None, ['6,200', '6200', '6 200'], []),
    ('Follow-up', 'Review the pilot after 17 days.', 'Bring the blue tally sheet to the review.',
     ['17 days', 'seventeen days'], ['blue tally sheet']),
]


def dependencies():
    packages = {
        'docx': 'python-docx', 'pptx': 'python-pptx', 'reportlab.pdfgen.canvas': 'reportlab',
        'PIL.Image': 'Pillow', 'msoffcrypto.format.ooxml': 'msoffcrypto-tool',
    }
    missing = []
    for module, package in packages.items():
        try:
            imported = importlib.import_module(module)
            if module == 'msoffcrypto.format.ooxml':
                imported.OOXMLFile.encrypt
        except (ImportError, AttributeError):
            missing.append(package)
    if missing:
        raise SystemExit('Install these Python packages before building the folder: ' + ', '.join(missing))


def scrub(path):
    """Strip identifying package properties from copies and generated Office files."""
    replacement = path.with_suffix('.scrubbed')
    with ZipFile(path) as source, ZipFile(replacement, 'w') as dest:
        for item in source.infolist():
            content = source.read(item)
            if item.filename in {'docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml'}:
                root = ElementTree.fromstring(content)
                for child in list(root):
                    root.remove(child)
                content = ElementTree.tostring(root, encoding='utf-8', xml_declaration=True)
            dest.writestr(item, content)
    replacement.replace(path)


def write_word(path, body):
    from docx import Document

    doc = Document()
    doc.add_heading(path.stem, level=1)
    doc.add_paragraph(body)
    doc.save(path)
    scrub(path)


def write_pdf(path, body, scan):
    from PIL import Image, ImageDraw, ImageFont
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen.canvas import Canvas

    pdf = Canvas(str(path), pagesize=A4)
    for setter in (pdf.setAuthor, pdf.setCreator, pdf.setProducer, pdf.setTitle, pdf.setSubject):
        setter('')
    if scan:
        image = Image.new('L', (1240, 1754), 245)
        draw = ImageDraw.Draw(image)
        font_path = scan_font()
        font = ImageFont.truetype(str(font_path), 32) if font_path else None
        if font is None:
            try:
                font = ImageFont.load_default(size=32)
            except TypeError:
                font = ImageFont.load_default()
        draw.text((100, 125), 'Branch visit form – Riverside', fill=25, font=font)
        draw.text((100, 225), '\n'.join(body.split('. ')), fill=35, font=font, spacing=16)
        pdf.drawImage(ImageReader(image.rotate(0.6, fillcolor=245)), 0, 0, *A4)
    else:
        pdf.setFont('Helvetica-Bold', 16)
        pdf.drawString(60, 770, 'Annual report 2025 · Branch network')
        pdf.setFont('Helvetica', 11)
        pdf.drawString(60, 735, body)
    pdf.save()


def scan_font():
    for candidate in (
        Path('/System/Library/Fonts/Supplemental/Arial.ttf'),
        Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
        Path('C:/Windows/Fonts/arial.ttf'),
    ):
        if candidate.is_file():
            return candidate
    return None


def build(folder):
    from msoffcrypto.format.ooxml import OOXMLFile
    from pptx import Presentation

    documents = []
    shared = SHARED.is_dir()
    for relative, body, words in BASE:
        path = folder / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if shared:
            shutil.copyfile(SHARED / relative, path)
            if path.suffix == '.docx':
                scrub(path)
        elif path.suffix == '.docx':
            write_word(path, body)
        else:
            write_pdf(path, body, '(scan)' in path.name)
        documents.append({
            'file': relative, 'words': words,
            'unreadReason': 'scan' if '(scan)' in path.name else None,
        })

    password = secrets.token_urlsafe(24)
    # Keep the unencrypted package in the staging directory, outside the workspace.
    clear = folder.parent / 'Confidential appendix.docx'
    write_word(clear, 'The confidential appendix reserves the slate cabinet for review materials.')
    with clear.open('rb') as source, (folder / PROTECTED).open('wb') as dest:
        OOXMLFile(source).encrypt(password, dest)
    clear.unlink()

    presentation = Presentation()
    slides = []
    for number, (title, body, note, words, note_words) in enumerate(SLIDES, 1):
        slide = presentation.slides.add_slide(presentation.slide_layouts[1])
        slide.shapes.title.text = title
        slide.placeholders[1].text = body
        if note is not None:
            slide.notes_slide.notes_text_frame.text = note
        slides.append({'number': number, 'words': words, 'noteWords': note_words})
    presentation.save(folder / DECK)
    scrub(folder / DECK)

    return {
        'documents': documents, 'passwordDocument': PROTECTED,
        'deck': {'file': DECK, 'slides': slides},
    }, password


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('out_dir', type=Path)
    out = parser.parse_args().out_dir
    dependencies()
    out.mkdir(parents=True, exist_ok=True)
    for destination in (out / NAME, out / 'facts.json'):
        if destination.exists() or destination.is_symlink():
            parser.error(f'{destination} already exists. Use a new output directory.')
    with tempfile.TemporaryDirectory(prefix='.reading-fixture-', dir=out) as staging:
        stage = Path(staging)
        facts, password = build(stage / NAME)
        (stage / 'facts.json').write_text(json.dumps(facts, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        (stage / NAME).rename(out / NAME)
        (stage / 'facts.json').rename(out / 'facts.json')
    print(f'Workspace: {out / NAME}', flush=True)
    print(f'Fixture password for {PROTECTED}: {password}', file=sys.stderr)


if __name__ == '__main__':
    main()
