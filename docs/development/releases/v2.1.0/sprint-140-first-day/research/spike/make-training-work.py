#!/usr/bin/env python3
"""
make-training-work.py - the #497 spike's fictional folders (Sprint 140, Phase 1, part A).

Usage: python3 make-training-work.py <out-dir>

Writes two folders under <out-dir>, fictional throughout:

  Training work/   20 Word documents, 10 PDFs (8 with text, 2 scanned: a picture of a page, no text layer),
                   4 spreadsheets and 3 Markdown files, in client folders. The five newest files are
                   3 Word documents and 2 PDFs.
  Training PDFs/   10 PDFs (8 with text, 2 scanned). The five newest are text PDFs.

Every document carries one planted fact that only reading it gives. facts.json beside the folders lists, per
folder, the five newest files and the words that show each fact was read. "Proposal to Harbour Logistics.docx"
answers the open-document question ("What did we promise Harbour about the team survey?"); an older Markdown note
holds a decoy ("to be decided"), so an answer that did not read the Word file shows it.

Office metadata is scrubbed: no author, no last-modified-by, no company, no application name (memory: Office
fixtures carry the saver's name). Needs python-docx, openpyxl, reportlab and Pillow.
"""

import json
import os
import sys
import time
from io import BytesIO

from docx import Document
from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

DAY = 86400
NOW = time.time()


def scrub_docx(doc):
    props = doc.core_properties
    for field in ('author', 'last_modified_by', 'title', 'subject', 'keywords', 'comments', 'category',
                  'content_status', 'identifier', 'language', 'version'):
        setattr(props, field, '')
    props.revision = 1


def write_docx(path, title, paragraphs):
    doc = Document()
    scrub_docx(doc)
    doc.add_heading(title, level=1)
    for paragraph in paragraphs:
        if paragraph.startswith('## '):
            doc.add_heading(paragraph[3:], level=2)
        elif paragraph.startswith('- '):
            doc.add_paragraph(paragraph[2:], style='List Bullet')
        else:
            doc.add_paragraph(paragraph)
    doc.save(path)


def new_pdf(path):
    pdf = canvas.Canvas(path, pagesize=A4)
    pdf.setAuthor('')
    pdf.setCreator('')
    pdf.setProducer('')
    pdf.setTitle('')
    pdf.setSubject('')
    return pdf


def write_text_pdf(path, title, paragraphs):
    pdf = new_pdf(path)
    width, height = A4
    y = height - 72
    pdf.setFont('Helvetica-Bold', 16)
    pdf.drawString(72, y, title)
    y -= 32
    pdf.setFont('Helvetica', 11)
    for paragraph in paragraphs:
        words = paragraph.split()
        line = ''
        for word in words:
            candidate = f'{line} {word}'.strip()
            if pdf.stringWidth(candidate, 'Helvetica', 11) > width - 144:
                pdf.drawString(72, y, line)
                y -= 16
                line = word
            else:
                line = candidate
        if line:
            pdf.drawString(72, y, line)
            y -= 16
        y -= 10
    pdf.showPage()
    pdf.save()


def write_scanned_pdf(path, title, paragraphs):
    """A page as a picture, as a scanner makes it: no text layer at all."""
    image = Image.new('L', (1240, 1754), 245)
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Times New Roman.ttf', 30)
        heading = ImageFont.truetype('/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf', 40)
    except OSError:
        font = heading = ImageFont.load_default()
    y = 140
    draw.text((140, y), title, fill=30, font=heading)
    y += 90
    for paragraph in paragraphs:
        line = ''
        for word in paragraph.split():
            candidate = f'{line} {word}'.strip()
            if draw.textlength(candidate, font=font) > 960:
                draw.text((140, y), line, fill=40, font=font)
                y += 44
                line = word
            else:
                line = candidate
        if line:
            draw.text((140, y), line, fill=40, font=font)
            y += 44
        y += 20
    image = image.rotate(0.6, fillcolor=245)
    buffer = BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    pdf = new_pdf(path)
    pdf.drawImage(ImageReader(buffer), 0, 0, width=A4[0], height=A4[1])
    pdf.showPage()
    pdf.save()


def write_xlsx(path, rows):
    book = Workbook()
    props = book.properties
    props.creator = ''
    props.lastModifiedBy = ''
    props.title = ''
    sheet = book.active
    for row in rows:
        sheet.append(row)
    book.save(path)


def write_md(path, text):
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(text)


def touch(path, days_ago, hour=10):
    stamp = NOW - days_ago * DAY + (hour - 12) * 3600
    os.utime(path, (stamp, stamp))


# ── Training work ───────────────────────────────────────────────────────────

# (relative path, kind, days ago, title, paragraphs, fact words)
TRAINING_WORK = [
    # The five newest: 3 Word documents, 2 PDFs
    ('Fernhollow Bank/Fernhollow Bank notes.docx', 'docx', 1.0, 'Fernhollow Bank: meeting notes', [
        'Monday, with the head of HR and two branch managers.',
        '## What they want',
        'A programme for 40 branch managers who now lead mixed teams of advisers and digital staff. The pilot group meets in Tartu in March, in the old savings hall on Rüütli street.',
        '## Next',
        'A proposal by 30 October, with a budget per half-day.',
    ], ['Tartu', 'March', '40 branch managers', '30 October', 'Rüütli', 'savings hall']),
    ('Riverside Hospital/Session plan, ward managers.docx', 'docx', 1.3, 'Session plan: ward managers', [
        'Three hours, twelve ward managers.',
        'The session moved to Thursday 12 November, because the night shift changes over on the Wednesday.',
        '- Warm-up: the hardest handover of the week',
        '- Practice in pairs: giving feedback at the end of a shift',
        '- Close: one thing to try before the next session',
    ], ['12 November', 'night shift', 'Thursday']),
    ('Harbour Logistics/Proposal to Harbour Logistics.docx', 'docx', 1.7, 'Proposal to Harbour Logistics', [
        'A leadership programme for 24 shift leaders at the Muuga terminal, in four modules.',
        '## The team survey',
        'We promised Harbour a short team survey in week 2 of the programme, run by Mari Tamm, with the results back to the shift leaders by 4 December.',
        '## Price',
        'Four modules, 2,400 euros each, travel included.',
    ], ['4 December', 'Mari Tamm', 'week 2', '2,400', '2400', '9,600', 'Muuga']),
    ('Fernhollow Bank/Fernhollow tender.pdf', 'pdf', 2.2, 'Fernhollow Bank: request for tenders', [
        'Fernhollow Bank invites proposals for a leadership programme for branch managers.',
        'The budget ceiling for the whole programme is 48,000 euros, excluding VAT.',
        'Proposals are evaluated on content (60%), price (30%) and references (10%).',
    ], ['48,000', '48 000', '48000', '60%']),
    ('Contracts/Riverside Hospital contract.pdf', 'pdf', 2.6, 'Training services agreement: Riverside Hospital', [
        'This agreement covers leadership training for ward managers at Riverside Hospital.',
        'It runs until 30 June 2027 and allows six reschedules without a fee, each announced a week ahead.',
        'Signed by both parties.',
    ], ['June 2027', 'six reschedules', '6 reschedules', 'six fee-free', 'reschedule']),
    # Older Word documents (17)
    ('Harbour Logistics/Harbour kickoff notes.docx', 'docx', 9, 'Harbour Logistics: kickoff', ['The shift leaders asked for sessions before 7 in the morning; the terminal starts at 7:30.'], []),
    ('Harbour Logistics/Module 1, safety conversations.docx', 'docx', 20, 'Module 1: safety conversations', ['A safety conversation starts with a question, not a rule. The quay crane story opens the module.'], []),
    ('Harbour Logistics/Module 2, giving feedback.docx', 'docx', 27, 'Module 2: giving feedback', ['Feedback within a day of the event, never in front of the crew.'], []),
    ('Harbour Logistics/Module 3, planning the shift.docx', 'docx', 34, 'Module 3: planning the shift', ['The night shift plans on a whiteboard that the morning shift photographs.'], []),
    ('Harbour Logistics/Invitation letter.docx', 'docx', 41, 'Invitation to the programme', ['Dear shift leader, the first module starts on a Tuesday, with coffee at 6:45.'], []),
    ('Riverside Hospital/Riverside programme outline.docx', 'docx', 48, 'Riverside Hospital: programme outline', ['Five sessions for ward managers, each three hours, in the hospital\'s library.'], []),
    ('Riverside Hospital/Feedback from session 1.docx', 'docx', 55, 'Feedback from session 1', ['Eleven of twelve said the pairs practice was the most useful part.'], []),
    ('Riverside Hospital/Handout, difficult conversations.docx', 'docx', 62, 'Handout: difficult conversations', ['Name what you saw, say what it means for the ward, ask what they need.'], []),
    ('Riverside Hospital/Interview with the head nurse.docx', 'docx', 70, 'Interview with the head nurse', ['She wants the managers to say no more often, and kindly.'], []),
    ('Fernhollow Bank/Fernhollow first call.docx', 'docx', 80, 'Fernhollow Bank: first call', ['They found us through the Riverside programme.'], []),
    ('Fernhollow Bank/Branch visit, Pärnu.docx', 'docx', 90, 'Branch visit: Pärnu', ['The Pärnu branch has nine advisers and three digital staff.'], []),
    ('Templates/Proposal template.docx', 'docx', 120, 'Proposal template', ['Context, what we propose, how it runs, price, references.'], []),
    ('Templates/Session plan template.docx', 'docx', 130, 'Session plan template', ['Goal, timing, materials, exercises, close.'], []),
    ('Templates/Workshop evaluation form.docx', 'docx', 140, 'Workshop evaluation form', ['Rate each exercise from 1 to 5.'], []),
    ('Contracts/Framework agreement draft.docx', 'docx', 160, 'Framework agreement (draft)', ['Payment within 21 days of the invoice.'], []),
    ('Invoices/Invoice notes 2025.docx', 'docx', 300, 'Invoice notes 2025', ['Harbour pays by the 15th of the month.'], []),
    ('Invoices/Reminder letter.docx', 'docx', 320, 'Payment reminder', ['A friendly reminder, sent after 30 days.'], []),
    # Older PDFs: 6 with text, 2 scanned
    ('Contracts/Harbour Logistics contract.pdf', 'pdf', 30, 'Training services agreement: Harbour Logistics', ['Signed. Four modules over one autumn.'], []),
    ('Contracts/Fernhollow NDA.pdf', 'pdf', 75, 'Confidentiality agreement: Fernhollow Bank', ['Both parties keep the branch figures confidential.'], []),
    ('Invoices/Invoice 2025-031.pdf', 'pdf', 200, 'Invoice 2025-031', ['Harbour Logistics, module 1, 2,400 euros.'], []),
    ('Invoices/Invoice 2025-044.pdf', 'pdf', 190, 'Invoice 2025-044', ['Riverside Hospital, session 1, 1,800 euros.'], []),
    ('Riverside Hospital/Riverside brochure.pdf', 'pdf', 100, 'Riverside Hospital: about us', ['A hospital of 640 beds by the river.'], []),
    ('Harbour Logistics/Terminal safety rules.pdf', 'pdf', 110, 'Muuga terminal: safety rules', ['Hard hats beyond the yellow line.'], []),
    ('Contracts/Signed order, Riverside (scan).pdf', 'scan', 95, 'Order confirmation', ['Riverside Hospital orders five sessions for ward managers. Signed by the head nurse.'], []),
    ('Invoices/Receipt, venue hire (scan).pdf', 'scan', 210, 'Receipt: venue hire', ['Venue hire, Tallinn, one day, 350 euros. Paid in cash.'], []),
    # Spreadsheets (4)
    ('Fernhollow Bank/Fernhollow budget.xlsx', 'xlsx', 3.5, None, [['Item', 'Euros'], ['Trainer days', 9600], ['Venue', 1400], ['Materials', 600]], []),
    ('Invoices/Invoices 2025.xlsx', 'xlsx', 150, None, [['Invoice', 'Client', 'Euros'], ['2025-031', 'Harbour Logistics', 2400], ['2025-044', 'Riverside Hospital', 1800]], []),
    ('Harbour Logistics/Participants.xlsx', 'xlsx', 25, None, [['Name', 'Shift'], ['Shift leader A', 'Night'], ['Shift leader B', 'Day']], []),
    ('Riverside Hospital/Attendance.xlsx', 'xlsx', 50, None, [['Session', 'Present'], [1, 11], [2, 12]], []),
    # Markdown (3)
    ('Harbour Logistics/Harbour notes.md', 'md', 12, None, '# Harbour notes\n\nTeam survey: to be decided.\n\nThey liked the quay crane story.\n', []),
    ('Ideas.md', 'md', 60, None, '# Ideas\n\n- A short course on running a good handover.\n- A podcast with shift leaders.\n', []),
    ('Riverside Hospital/Riverside to do.md', 'md', 45, None, '# To do\n\n- Book the library for session 3.\n', []),
]

# ── Training PDFs ───────────────────────────────────────────────────────────

TRAINING_PDFS = [
    ('Fernhollow tender.pdf', 'pdf', 1.0, 'Fernhollow Bank: request for tenders', [
        'Fernhollow Bank invites proposals for a leadership programme for branch managers.',
        'The budget ceiling for the whole programme is 48,000 euros, excluding VAT.',
    ], ['48,000', '48 000', '48000']),
    ('Riverside Hospital contract.pdf', 'pdf', 1.4, 'Training services agreement: Riverside Hospital', [
        'It runs until 30 June 2027 and allows six reschedules without a fee.',
    ], ['30 June 2027', 'six reschedules', '6 reschedules']),
    ('Harbour survey results.pdf', 'pdf', 1.8, 'Harbour Logistics: team survey results', [
        'Twenty-one of the 24 shift leaders answered. Trust in the night shift rose from 3.1 to 3.9 out of 5.',
    ], ['3.9', '21 of', 'twenty-one', '3.1']),
    ('Venue offer, Tartu.pdf', 'pdf', 2.3, 'Venue offer: the old savings hall, Tartu', [
        'The hall seats 40 and costs 380 euros a day, coffee included.',
    ], ['380']),
    ('Trainer CV, Mari Tamm.pdf', 'pdf', 2.9, 'Curriculum vitae: Mari Tamm', [
        'Mari Tamm has trained shift leaders in ports for eleven years and speaks Estonian, Finnish and English.',
    ], ['eleven years', '11 years', 'Finnish']),
    ('Harbour Logistics contract.pdf', 'pdf', 30, 'Training services agreement: Harbour Logistics', ['Signed. Four modules over one autumn.'], []),
    ('Fernhollow NDA.pdf', 'pdf', 75, 'Confidentiality agreement: Fernhollow Bank', ['Both parties keep the branch figures confidential.'], []),
    ('Terminal safety rules.pdf', 'pdf', 110, 'Muuga terminal: safety rules', ['Hard hats beyond the yellow line.'], []),
    ('Signed order, Riverside (scan).pdf', 'scan', 95, 'Order confirmation', ['Riverside Hospital orders five sessions for ward managers.'], []),
    ('Receipt, venue hire (scan).pdf', 'scan', 210, 'Receipt: venue hire', ['Venue hire, Tallinn, one day, 350 euros.'], []),
]


def build(root, entries):
    newest = []
    for relative, kind, days_ago, title, content, facts in entries:
        path = os.path.join(root, relative)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if kind == 'docx':
            write_docx(path, title, content)
        elif kind == 'pdf':
            write_text_pdf(path, title, content)
        elif kind == 'scan':
            write_scanned_pdf(path, title, content)
        elif kind == 'xlsx':
            write_xlsx(path, content)
        elif kind == 'md':
            write_md(path, content)
        touch(path, days_ago)
        if facts:
            newest.append({'file': relative, 'kind': kind, 'facts': facts})
    for folder, _dirs, _files in os.walk(root):
        os.utime(folder, (NOW - 1 * DAY, NOW - 1 * DAY))
    return newest


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    out = sys.argv[1]
    facts = {
        'Training work': build(os.path.join(out, 'Training work'), TRAINING_WORK),
        'Training PDFs': build(os.path.join(out, 'Training PDFs'), TRAINING_PDFS),
        'open_document': {
            'file': 'Harbour Logistics/Proposal to Harbour Logistics.docx',
            'question': 'What did we promise Harbour about the team survey?',
            'facts': ['4 December', 'Mari Tamm', 'week 2'],
            'decoy': 'to be decided',
        },
    }
    with open(os.path.join(out, 'facts.json'), 'w', encoding='utf-8') as handle:
        json.dump(facts, handle, indent=2, ensure_ascii=False)
    print(json.dumps({k: len(v) if isinstance(v, list) else 1 for k, v in facts.items()}))


if __name__ == '__main__':
    main()
