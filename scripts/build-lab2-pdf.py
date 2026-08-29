"""Build the single Lab 2 evidence PDF from repository sources and real artifacts."""

from __future__ import annotations

import argparse
import html
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "CPE334_Lab2_67070501002.pdf"
FINAL_VERIFICATION = ROOT / "tmp" / "pdfs" / "final-verification.txt"
SUBMISSION_EVIDENCE = ROOT / "tmp" / "pdfs" / "github-evidence.md"
MAX_SCREENSHOT_HEIGHT = 3.1 * inch


class EvidenceError(RuntimeError):
    pass


def read_text(path: Path) -> str:
    if not path.is_file():
        raise EvidenceError(f"Missing required evidence source: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return result.stdout.strip()


def escape_inline(value: str) -> str:
    escaped = html.escape(value, quote=False)
    escaped = re.sub(r"`([^`]+)`", r"<font name='Courier'>\1</font>", escaped)
    escaped = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"<link href='\2' color='#0B7A46'>\1</link>", escaped)
    return escaped


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "LabTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=27,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#006B3C"),
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "LabSubtitle",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#33564A"),
            spaceAfter=8,
        ),
        "part": ParagraphStyle(
            "AnswerPart",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=21,
            textColor=colors.HexColor("#006B3C"),
            spaceBefore=4,
            spaceAfter=10,
            keepWithNext=True,
        ),
        "h1": ParagraphStyle(
            "DocH1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=17,
            textColor=colors.HexColor("#0B7A46"),
            spaceBefore=8,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "DocH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#0B7A46"),
            spaceBefore=6,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "DocH3",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#33564A"),
            spaceBefore=5,
            spaceAfter=3,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.4,
            leading=11.2,
            textColor=colors.HexColor("#23372F"),
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=7.2,
            leading=9,
            textColor=colors.HexColor("#23372F"),
            spaceAfter=3,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8.2,
            leading=10.8,
            leftIndent=12,
            firstLineIndent=-8,
            bulletIndent=0,
            textColor=colors.HexColor("#23372F"),
            spaceAfter=2,
        ),
        "caption": ParagraphStyle(
            "Caption",
            parent=base["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=7.2,
            leading=9,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#33564A"),
            spaceBefore=2,
            spaceAfter=5,
        ),
        "code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=6.6,
            leading=8.2,
            textColor=colors.HexColor("#23372F"),
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            parent=base["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=6.6,
            leading=8,
            textColor=colors.white,
        ),
        "table": ParagraphStyle(
            "Table",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=6.4,
            leading=7.8,
            textColor=colors.HexColor("#23372F"),
        ),
    }


def markdown_blocks(markdown: str, styles) -> list[Flowable]:
    """Render the subset of Markdown used by the repository docs."""
    story: list[Flowable] = []
    lines = markdown.replace("\r\n", "\n").split("\n")
    index = 0
    paragraph_lines: list[str] = []

    def flush_paragraph() -> None:
        if paragraph_lines:
            text = " ".join(line.strip() for line in paragraph_lines).strip()
            if text:
                story.append(Paragraph(escape_inline(text), styles["body"]))
            paragraph_lines.clear()

    while index < len(lines):
        line = lines[index]
        if line.strip().startswith("```"):
            flush_paragraph()
            index += 1
            code_lines: list[str] = []
            while index < len(lines) and not lines[index].strip().startswith("```"):
                code_lines.append(lines[index])
                index += 1
            if index < len(lines):
                index += 1
            code = "\n".join(code_lines).strip("\n")
            if code:
                story.append(Preformatted(code, styles["code"], maxLineLength=110))
                story.append(Spacer(1, 3))
            continue

        heading = re.match(r"^(#{1,3})\s+(.+?)\s*$", line)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            style = styles["h1" if level == 1 else "h2" if level == 2 else "h3"]
            story.append(Paragraph(escape_inline(heading.group(2)), style))
            index += 1
            continue

        if re.match(r"^\s*\|", line) and index + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[index + 1]):
            flush_paragraph()
            table_lines: list[str] = []
            while index < len(lines) and re.match(r"^\s*\|", lines[index]):
                table_lines.append(lines[index])
                index += 1
            story.extend(markdown_table(table_lines, styles))
            continue

        if re.match(r"^\s*[-*]\s+", line):
            flush_paragraph()
            bullet_text = re.sub(r"^\s*[-*]\s+", "", line).strip()
            checked = bullet_text.startswith("[x] ")
            if checked:
                bullet_text = "[x] " + bullet_text[4:]
            story.append(Paragraph(f"{escape_inline('•')} {escape_inline(bullet_text)}", styles["bullet"]))
            index += 1
            continue

        if not line.strip():
            flush_paragraph()
            index += 1
            continue

        paragraph_lines.append(line)
        index += 1

    flush_paragraph()
    return story


def split_table_row(line: str) -> list[str]:
    content = line.strip().strip("|")
    return [part.strip() for part in content.split("|")]


def markdown_table(lines: list[str], styles) -> list[Flowable]:
    if len(lines) < 2:
        return []
    header = split_table_row(lines[0])
    rows = [split_table_row(line) for line in lines[2:]]
    width = max(len(header), *(len(row) for row in rows), 1)
    header += [""] * (width - len(header))
    normalized = [header] + [row + [""] * (width - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = styles["table_head"] if row_index == 0 else styles["table"]
        data.append([Paragraph(escape_inline(cell), style) for cell in row])
    table = Table(data, repeatRows=1, hAlign="LEFT", colWidths=[6.65 * inch / width] * width)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B7A46")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B7CEC3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4FAF7")]),
    ]))
    return [table, Spacer(1, 5)]


def add_section(story: list[Flowable], title: str, content: Iterable[Flowable]) -> None:
    story.append(Paragraph(title, make_styles()["h2"]))
    story.extend(content)


def screenshot_files(group: str, include: Iterable[str] | None = None) -> list[Path]:
    directory = ROOT / "artifacts" / "lab-02" / "screenshots" / group
    if not directory.is_dir():
        raise EvidenceError(f"Missing screenshot directory: {directory.relative_to(ROOT)}")
    files = sorted(directory.glob("*.png"))
    if not files:
        raise EvidenceError(f"No PNG evidence in {directory.relative_to(ROOT)}")
    if include is None:
        return files
    selected = []
    for name in include:
        path = directory / name
        if not path.is_file():
            raise EvidenceError(f"Missing screenshot evidence: {path.relative_to(ROOT)}")
        selected.append(path)
    return selected


def image_cell(path: Path, width: float, caption: str, styles) -> Table:
    with PILImage.open(path) as image:
        source_width, source_height = image.size
    height = width * source_height / source_width
    image_width = width
    if height > MAX_SCREENSHOT_HEIGHT:
        image_width = width * MAX_SCREENSHOT_HEIGHT / height
        height = MAX_SCREENSHOT_HEIGHT
    image_flowable = Image(str(path), width=image_width, height=height)
    image_flowable.hAlign = "CENTER"
    table = Table([[image_flowable], [Paragraph(escape_inline(caption), styles["caption"])]], colWidths=[width])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return table


def add_image_grid(story: list[Flowable], paths: list[Path], title: str, styles, columns: int = 2) -> None:
    story.append(Paragraph(title, styles["h3"]))
    width = (6.65 * inch - (columns - 1) * 0.14 * inch) / columns
    cells = []
    for path in paths:
        caption = path.stem.replace("-", " ")
        cells.append(image_cell(path, width, f"Figure: {caption}", styles))
    rows = []
    for start in range(0, len(cells), columns):
        row = cells[start:start + columns]
        row += [""] * (columns - len(row))
        rows.append(row)
    grid = Table(rows, colWidths=[width] * columns, hAlign="LEFT")
    grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(grid)


def add_link_table(story: list[Flowable], styles) -> None:
    rows = [
        [Paragraph("Evidence", styles["table_head"]), Paragraph("Source", styles["table_head"])],
        [Paragraph("Repository", styles["table"]), Paragraph("<link href='https://github.com/ArmmyC/CPE334-TokTickIT-Lab1' color='#0B7A46'>github.com/ArmmyC/CPE334-TokTickIT-Lab1</link>", styles["table"])],
        [Paragraph("Project board", styles["table"]), Paragraph("<link href='https://github.com/users/ArmmyC/projects/3' color='#0B7A46'>TokTickIT Individual Sprints</link>", styles["table"])],
        [Paragraph("Lab 2 contract PR", styles["table"]), Paragraph("<link href='https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/21' color='#0B7A46'>PR #21</link>", styles["table"])],
        [Paragraph("Documentation PR", styles["table"]), Paragraph("<link href='https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/28' color='#0B7A46'>PR #28</link>", styles["table"])],
        [Paragraph("Release PR", styles["table"]), Paragraph("<link href='https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/29' color='#0B7A46'>PR #29</link>", styles["table"])],
    ]
    table = Table(rows, colWidths=[1.55 * inch, 5.1 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B7A46")),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B7CEC3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4FAF7")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(table)


def build(output: Path) -> None:
    styles = make_styles()
    required_docs = {
        "spec": ROOT / "docs" / "lab-02" / "specification.md",
        "api": ROOT / "docs" / "lab-02" / "api-spec.md",
        "ui": ROOT / "docs" / "lab-02" / "ui-spec.md",
        "tests": ROOT / "docs" / "lab-02" / "tests.md",
        "reviewer": ROOT / "docs" / "lab-02" / "reviewer.md",
        "ai": ROOT / "docs" / "lab-02" / "ai-use.md",
        "readme": ROOT / "README.md",
        "gitignore": ROOT / ".gitignore",
    }
    sources = {key: read_text(path) for key, path in required_docs.items()}
    verification = read_text(FINAL_VERIFICATION)
    github_evidence = read_text(SUBMISSION_EVIDENCE)

    if not re.search(r"^Answer Part 1", github_evidence, re.MULTILINE):
        raise EvidenceError("github-evidence.md must contain final release evidence")
    expected_part_headings = [f"Answer Part {part}" for part in range(1, 10)]

    create_paths = screenshot_files(
        "create-ticket",
        [
            "desktop-initial.png",
            "desktop-validation.png",
            "desktop-invalid-attachment.png",
            "desktop-api-failure-retained.png",
            "desktop-submitting.png",
            "desktop-success.png",
            "mobile-initial.png",
            "mobile-success.png",
            "tablet-success.png",
        ],
    )
    my_paths = screenshot_files("my-tickets")
    detail_paths = screenshot_files("ticket-detail")
    selector_dir = ROOT / "artifacts" / "lab-02" / "screenshots" / "submission"
    selector_paths = sorted(selector_dir.glob("*.png")) if selector_dir.is_dir() else []
    if not selector_paths:
        raise EvidenceError("Missing requester-selector evidence under artifacts/lab-02/screenshots/submission")

    output.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(output),
        pagesize=A4,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.52 * inch,
        bottomMargin=0.52 * inch,
        title="CPE334 Lab 2 TokTickIT Evidence",
        author="Kamolpop Vitayarat",
    )
    story: list[Flowable] = []

    story.append(Spacer(1, 0.75 * inch))
    story.append(Paragraph("CPE334 Lab 2", styles["title"]))
    story.append(Paragraph("TokTickIT Requester Ticketing MVP with UI Foundation", styles["subtitle"]))
    story.append(Paragraph("Student 67070501002, Kamolpop Vitayarat, GitHub @ArmmyC", styles["subtitle"]))
    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph("This evidence package is generated from the final repository sources, real GitHub workflow records, test output, and Playwright screenshots. The repository and final main branch remain the source of truth.", styles["body"]))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 1", styles["part"]))
    story.append(Paragraph("Git Use with Engineering Workflow", styles["h1"]))
    story.append(Paragraph("The Lab 2 work was implemented on Issue branches and merged by Bank848 into lab2-staging. The documentation branch is included in the reviewer record, and the final release evidence is copied from the real GitHub page after the staging-to-main merge.", styles["body"]))
    add_link_table(story, styles)
    story.append(Paragraph("Final-main commit history", styles["h2"]))
    story.append(Preformatted(run_git("log", "main", "--date=short", "--pretty=format:%h %ad %s", "-25"), styles["code"], maxLineLength=110))
    story.append(Paragraph("Final release and board evidence", styles["h2"]))
    story.extend(markdown_blocks(github_evidence, styles))
    story.append(Paragraph("Rendered reviewer.md", styles["h2"]))
    story.extend(markdown_blocks(sources["reviewer"], styles))
    story.append(Paragraph("README and .gitignore evidence", styles["h2"]))
    story.extend(markdown_blocks(sources["readme"], styles))
    story.extend(markdown_blocks("```text\n" + sources["gitignore"] + "\n```", styles))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 2", styles["part"]))
    story.append(Paragraph("Spec DD", styles["h1"]))
    story.append(Paragraph("The contract was committed before the product implementation PRs and contains numbered functional requirements, business rules, data decisions, API behavior, acceptance criteria, and the Definition of Done.", styles["body"]))
    story.extend(markdown_blocks(sources["spec"], styles))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 3", styles["part"]))
    story.append(Paragraph("Test DD and Traceability", styles["h1"]))
    story.extend(markdown_blocks(sources["tests"], styles))
    story.append(Paragraph("Final-main verification output", styles["h2"]))
    story.append(Preformatted(verification, styles["code"], maxLineLength=110))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 4", styles["part"]))
    story.append(Paragraph("AI Use with Reflection", styles["h1"]))
    story.extend(markdown_blocks(sources["ai"], styles))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 5", styles["part"]))
    story.append(Paragraph("Development Requester Select Screen", styles["h1"]))
    story.append(Paragraph("The selector loads active Development Requesters from PostgreSQL, excludes the inactive seeded requester, stores the selected id in session storage, and clearly labels the context as Lab 2 testing rather than authentication.", styles["body"]))
    add_image_grid(story, selector_paths, "Requester context evidence", styles, columns=2)
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 6", styles["part"]))
    story.append(Paragraph("Working Ticket Screen: Create Mode", styles["h1"]))
    story.append(Paragraph("These screenshots show the required initial, validation, invalid-attachment, API-failure-with-retained-values, submitting, and success states. The desktop flow also shows the backend-generated Ticket Number and the saved requester context.", styles["body"]))
    add_image_grid(story, create_paths, "Create Ticket states", styles, columns=2)
    story.append(Paragraph("The complete evidence set is stored in `artifacts/lab-02/screenshots/create-ticket/`, with desktop, tablet, and mobile prefixes for every required state.", styles["body"]))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 7", styles["part"]))
    story.append(Paragraph("Working My Tickets Screen", styles["h1"]))
    story.append(Paragraph("The list is requester-scoped and supports search, filters, sorting, pagination, empty and no-results states, and safe cross-requester rejection. Desktop uses a table while smaller viewports use the responsive representation.", styles["body"]))
    add_image_grid(story, my_paths, "My Tickets filtered evidence", styles, columns=2)
    story.append(Paragraph("The test traceability and final verification log document the empty, no-results, requester switch, and ownership cases exercised by the E2E flow.", styles["body"]))
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 8", styles["part"]))
    story.append(Paragraph("Working Ticket Screen: View Mode and Attachments", styles["h1"]))
    story.append(Paragraph("Ticket Detail is read-only for requester-owned fields. Active image and PDF attachments expose preview or download, a new attachment can be added, and removal records a required reason while retaining metadata. Removed and foreign content uses the safe not-found behavior.", styles["body"]))
    add_image_grid(story, detail_paths, "Ticket Detail and attachment lifecycle evidence", styles, columns=2)
    story.append(PageBreak())

    story.append(Paragraph("Answer Part 9", styles["part"]))
    story.append(Paragraph("Zen Green UI and Responsive Evidence", styles["h1"]))
    story.extend(markdown_blocks(sources["ui"], styles))
    story.append(Paragraph("The required color tokens are Primary `#006B3C`, Secondary `#0B7A46`, Pale `#EAF6EF`, and page background `#F5F7F6`. The visual checklist records field states, button hierarchy, validation placement, clipping, overlap, and horizontal overflow checks.", styles["body"]))
    story.append(Paragraph("The screenshot groups include desktop `1440 x 900`, tablet `834 x 1112`, and mobile `390 x 844` evidence. The final E2E run checked horizontal overflow at each major screen.", styles["body"]))

    actual_part_headings = [
        flowable.getPlainText().strip()
        for flowable in story
        if isinstance(flowable, Paragraph) and flowable.getPlainText().strip().startswith("Answer Part ")
    ]
    if actual_part_headings != expected_part_headings:
        raise EvidenceError(
            "document headings must be Answer Part 1 through Answer Part 9 in order"
        )

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#B7CEC3"))
        canvas.setLineWidth(0.4)
        canvas.line(doc.leftMargin, 0.36 * inch, A4[0] - doc.rightMargin, 0.36 * inch)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#33564A"))
        canvas.drawString(doc.leftMargin, 0.2 * inch, "CPE334 Lab 2, TokTickIT, 67070501002")
        canvas.drawRightString(A4[0] - doc.rightMargin, 0.2 * inch, f"Page {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=footer, onLaterPages=footer)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output = args.output if args.output.is_absolute() else ROOT / args.output
    try:
        build(output)
    except EvidenceError as error:
        print(f"Evidence error: {error}", file=sys.stderr)
        return 2
    print(f"Wrote {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
