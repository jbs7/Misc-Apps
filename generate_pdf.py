import json
import os
import sys
import time
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, 
    PageBreak, FrameBreak, Flowable, NextPageTemplate
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfgen import canvas
from reportlab.platypus.tables import Table, TableStyle

# Register Georgia font families for Unicode support
try:
    pdfmetrics.registerFont(TTFont('Georgia', '/System/Library/Fonts/Supplemental/Georgia.ttf'))
    pdfmetrics.registerFont(TTFont('Georgia-Bold', '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Georgia-Italic', '/System/Library/Fonts/Supplemental/Georgia Italic.ttf'))
    pdfmetrics.registerFont(TTFont('Georgia-BoldItalic', '/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf'))
    registerFontFamily('Georgia', normal='Georgia', bold='Georgia-Bold', italic='Georgia-Italic', boldItalic='Georgia-BoldItalic')
    FONT_NAME = 'Georgia'
    print("Successfully loaded Georgia font.")
except Exception as e:
    print(f"Warning: Could not load Georgia font ({e}). Falling back to Helvetica.")
    FONT_NAME = 'Helvetica'

# --- Custom Flowables ---

class SetBookName(Flowable):
    """Zero-size flowable that sets the current book name on the canvas for running headers."""
    def __init__(self, name):
        Flowable.__init__(self)
        self.name = name
    def draw(self):
        self.canv.current_book_name = self.name
    def wrap(self, availWidth, availHeight):
        return 0, 0

class RecordBookPage(Flowable):
    """Zero-size flowable that records the page number when a book starts."""
    def __init__(self, book_num, book_name, page_records):
        Flowable.__init__(self)
        self.book_num = book_num
        self.book_name = book_name
        self.page_records = page_records
    def draw(self):
        page_num = self.canv.getPageNumber()
        self.page_records[str(self.book_num)] = (self.book_name, page_num)
    def wrap(self, availWidth, availHeight):
        return 0, 0

# --- Custom Canvas for Page Numbers & Headers ---

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, page_count):
        # Page 1: Cover page - no decorations
        if self._pageNumber == 1:
            return
            
        self.saveState()
        self.setFont(FONT_NAME, 9)
        self.setStrokeColor(HexColor("#CCCCCC"))
        self.setLineWidth(0.5)
        
        # 1. Header (only on pages after the cover and TOC placeholder/pages)
        book_name = getattr(self, 'current_book_name', '')
        # Don't draw book headers on page 2 and 3 (TOC)
        if self._pageNumber > 3:
            self.line(36, 745, 576, 745)
            if book_name:
                self.drawString(36, 752, book_name.upper())
                
        # 2. Footer (always draw line and page number on all pages > 1)
        self.line(36, 45, 576, 45)
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawCentredString(306, 28, page_str)
        self.restoreState()

# --- Main PDF Generator ---

def generate_bible_pdf():
    json_path = "mizo_kjv_bible.json"
    pdf_path = "mizo_kjv_bible.pdf"
    toc_path = "toc.json"
    
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found. Run downloader first.")
        sys.exit(1)
        
    print("Loading Bible JSON...")
    with open(json_path, 'r', encoding='utf-8') as f:
        bible_data = json.load(f)
        
    # We will record starting pages during compile
    page_records = {}
    
    # Check if we have pre-recorded page numbers from a previous pass
    toc_data = {}
    if os.path.exists(toc_path):
        try:
            with open(toc_path, 'r') as f:
                toc_data = json.load(f)
            print("Loaded TOC data from previous pass.")
        except Exception as e:
            print(f"Could not load TOC: {e}")

    # Styles
    styles = getSampleStyleSheet()
    
    # Custom Styles using registered Georgia font (or Helvetica fallback)
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Bold",
        fontSize=28,
        leading=34,
        textColor=HexColor("#1A365D"),  # Deep Navy Blue
        alignment=TA_CENTER,
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Italic",
        fontSize=14,
        leading=18,
        textColor=HexColor("#4A5568"),
        alignment=TA_CENTER,
        spaceAfter=150
    )
    
    meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=10,
        leading=14,
        textColor=HexColor("#718096"),
        alignment=TA_CENTER
    )
    
    toc_header_style = ParagraphStyle(
        'TOCHeader',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Bold",
        fontSize=14,
        leading=18,
        textColor=HexColor("#1A365D"),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    book_title_style = ParagraphStyle(
        'BookTitle',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Bold",
        fontSize=16,
        leading=20,
        textColor=HexColor("#1A365D"),
        alignment=TA_CENTER,
        spaceBefore=15,
        spaceAfter=5,
        keepWithNext=True
    )
    
    book_info_style = ParagraphStyle(
        'BookInfo',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Italic",
        fontSize=8,
        leading=11,
        textColor=HexColor("#4A5568"),
        alignment=TA_CENTER,
        spaceAfter=10,
        keepWithNext=True
    )
    
    book_desc_style = ParagraphStyle(
        'BookDesc',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=8.5,
        leading=12,
        textColor=HexColor("#2D3748"),
        alignment=TA_JUSTIFY,
        spaceAfter=15,
        leftIndent=15,
        rightIndent=15,
        keepWithNext=True
    )
    
    chapter_title_style = ParagraphStyle(
        'ChapterTitle',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Bold",
        fontSize=11,
        leading=14,
        textColor=HexColor("#2B6CB0"),
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=6,
        keepWithNext=True
    )
    
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName=f"{FONT_NAME}-Bold",
        fontSize=8.5,
        leading=11,
        textColor=HexColor("#2D3748"),
        alignment=TA_CENTER,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )
    
    verse_style = ParagraphStyle(
        'VerseText',
        parent=styles['Normal'],
        fontName=FONT_NAME,
        fontSize=9,
        leading=12,
        textColor=HexColor("#1A202C"),
        alignment=TA_JUSTIFY,
        firstLineIndent=12,
        spaceAfter=4
    )

    story = []
    
    # ==================== PAGE 1: COVER PAGE ====================
    story.append(Spacer(1, 100))
    story.append(Paragraph("MIZO KING JAMES BIBLE", title_style))
    story.append(Paragraph("Mizo King James Bible App Dataset", subtitle_style))
    story.append(Spacer(1, 150))
    story.append(Paragraph("Edited and Published by The Christian Research Centre Publication Inc.<br/>Kanan Veng, Aizawl, Mizoram, India", meta_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"Generated PDF Edition &bull; {time.strftime('%B %Y')}", meta_style))
    story.append(PageBreak())
    
    # ==================== PAGES 2-3: TABLE OF CONTENTS ====================
    story.append(SetBookName("Table of Contents"))
    story.append(Paragraph("BIBLE CHHUNG THUTE (TABLE OF CONTENTS)", title_style))
    story.append(Spacer(1, 10))
    
    # If we have TOC data, draw it, otherwise draw a placeholder
    if toc_data:
        story.append(Paragraph("<b>UPRANG (OLD TESTAMENT)</b>", toc_header_style))
        for i in range(1, 40):
            book_num_str = str(i)
            if book_num_str in toc_data:
                name, page = toc_data[book_num_str]
                # Format book name with dots
                t = Table([[name, f"Page {page}"]], colWidths=[200, 61])
                t.setStyle(TableStyle([
                    ('ALIGN', (0,0), (0,0), 'LEFT'),
                    ('ALIGN', (1,0), (1,0), 'RIGHT'),
                    ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
                    ('FONTSIZE', (0,0), (-1,-1), 9),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                    ('TOPPADDING', (0,0), (-1,-1), 1),
                ]))
                story.append(t)
        
        story.append(FrameBreak()) # Move to second column for New Testament
        
        story.append(Paragraph("<b>THUTHlung thar (NEW TESTAMENT)</b>", toc_header_style))
        for i in range(40, 67):
            book_num_str = str(i)
            if book_num_str in toc_data:
                name, page = toc_data[book_num_str]
                t = Table([[name, f"Page {page}"]], colWidths=[200, 61])
                t.setStyle(TableStyle([
                    ('ALIGN', (0,0), (0,0), 'LEFT'),
                    ('ALIGN', (1,0), (1,0), 'RIGHT'),
                    ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
                    ('FONTSIZE', (0,0), (-1,-1), 9),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 1),
                    ('TOPPADDING', (0,0), (-1,-1), 1),
                ]))
                story.append(t)
    else:
        story.append(Paragraph("Table of Contents is generating... This page will be populated in the second pass.", toc_header_style))
        story.append(FrameBreak())
        story.append(Paragraph("Generating New Testament list...", toc_header_style))
        
    story.append(PageBreak())
    
    # ==================== BIBLE CONTENT ====================
    print("Processing Bible books...")
    for book_num in range(1, 67):
        book_num_str = str(book_num)
        if book_num_str not in bible_data:
            continue
            
        book_entry = bible_data[book_num_str]
        fields = book_entry.get('fields', {})
        book_name = fields.get('name', {}).get('stringValue', '').upper()
        author = fields.get('author', {}).get('stringValue', '')
        year = fields.get('year', {}).get('stringValue', '')
        description = fields.get('description', {}).get('stringValue', '').strip()
        
        # 1. Book Start Indicators
        story.append(SetBookName(book_name))
        story.append(RecordBookPage(book_num, book_name, page_records))
        
        # 2. Book Title
        story.append(Paragraph(book_name, book_title_style))
        
        # 3. Book Metadata (Author & Year)
        info_parts = []
        if author: info_parts.append(f"Ziah tu: {author}")
        if year: info_parts.append(f"Ziah kum: {year}")
        if info_parts:
            story.append(Paragraph(" &bull; ".join(info_parts), book_info_style))
            
        # 4. Book Description/Intro
        if description:
            story.append(Paragraph(description, book_desc_style))
            
        story.append(Spacer(1, 5))
        
        # 5. Process Chapters
        chapters = fields.get('chapters', {}).get('arrayValue', {}).get('values', [])
        for ch_val in chapters:
            ch_fields = ch_val.get('mapValue', {}).get('fields', {})
            ch_num = ch_fields.get('number', {}).get('integerValue') or ch_fields.get('number', {}).get('stringValue')
            
            # Chapter Heading
            story.append(Paragraph(f"BUNG {ch_num}", chapter_title_style))
            
            # Group verses to optimize flowable count
            verses = ch_fields.get('verses', {}).get('arrayValue', {}).get('values', [])
            
            current_paragraph_text = []
            
            for v_val in verses:
                v_fields = v_val.get('mapValue', {}).get('fields', {})
                v_num = v_fields.get('number', {}).get('integerValue') or v_fields.get('number', {}).get('stringValue')
                v_content = v_fields.get('content', {}).get('stringValue', '').strip()
                v_ref = v_fields.get('references', {}).get('stringValue', '').strip()
                is_paragraph_start = v_fields.get('paragraph', {}).get('booleanValue', False)
                is_section_start = v_fields.get('section', {}).get('booleanValue', False)
                section_title = v_fields.get('sectionTitle', {}).get('stringValue', '').strip()
                
                # Format verse token
                # ReportLab Paragraph supports <super> for superscript
                # References are omitted per user request
                verse_html = f'<super size="6.5"><b>{v_num}</b></super>{v_content} '
                
                if is_section_start:
                    # Flush current paragraph
                    if current_paragraph_text:
                        story.append(Paragraph("".join(current_paragraph_text), verse_style))
                        current_paragraph_text = []
                    
                    # Section break title
                    if section_title:
                        story.append(Paragraph(section_title.upper(), section_title_style))
                        
                    current_paragraph_text.append(verse_html)
                    
                elif is_paragraph_start:
                    # Flush current paragraph
                    if current_paragraph_text:
                        story.append(Paragraph("".join(current_paragraph_text), verse_style))
                        current_paragraph_text = []
                        
                    current_paragraph_text.append(verse_html)
                else:
                    # Normal run
                    current_paragraph_text.append(verse_html)
                    
            # Flush final paragraph of chapter
            if current_paragraph_text:
                story.append(Paragraph("".join(current_paragraph_text), verse_style))
                
        # Book ends: add a page break before the next book
        story.append(PageBreak())

    # Build Doc Template
    print("Building document...")
    doc = BaseDocTemplate(pdf_path, pagesize=letter)
    
    # Frame definition
    # margins: left 36, right 36, bottom 50, top 50 (w = 612, h = 792)
    # printable width = 540
    # gutter = 16
    # column width = 262
    frame_left = Frame(36, 50, 262, 690, id='col1', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    frame_right = Frame(314, 50, 262, 690, id='col2', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    
    # We want a single-column frame for the Cover Page
    frame_cover = Frame(54, 54, 504, 684, id='cover_frame', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    
    # Page templates
    template_cover = PageTemplate(id='Cover', frames=frame_cover)
    template_bible = PageTemplate(id='TwoCol', frames=[frame_left, frame_right])
    
    doc.addPageTemplates([template_cover, template_bible])
    
    # Trigger template changes in the story:
    # First template is 'Cover' by default since it is added first.
    # We want to change to 'TwoCol' on page 2 (TOC onwards)
    story.insert(1, NextPageTemplate('TwoCol'))
    
    # Compile
    start_time = time.time()
    doc.build(story, canvasmaker=NumberedCanvas)
    duration = time.time() - start_time
    print(f"PDF built successfully in {duration:.1f} seconds.")
    
    # Write page records to toc.json for second pass
    if page_records:
        with open(toc_path, 'w') as f:
            json.dump(page_records, f, indent=2)
        print("Updated TOC metadata.")
        
    return page_records


if __name__ == '__main__':
    # First pass
    print("=== PASS 1 ===")
    generate_bible_pdf()
    
    # Second pass (to populate the TOC with page numbers)
    print("\n=== PASS 2 ===")
    generate_bible_pdf()
    
    print("\nGeneration finished completely.")
