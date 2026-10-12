# MathMe internship project report

The internship project report for **MathMe 3D Studio**, by Sulaimaan (BCA, Semester III).

It follows the college's report rules:
- **Font:** Times New Roman. Headings are **16 pt bold**; all other text (body, tables, captions, lists) is **12 pt normal**.
- **Line spacing:** 1.5 on every line.
- **Order:** cover, certificate, college certificate, student declaration, acknowledgement, table of contents,
  executive summary, Chapter I: Introduction, Chapter II: Description of the Organization, Chapter III:
  Experiential Learning, Chapter IV: Internship Outcomes and Conclusion, bibliography.
- **Screenshots:** the outputs are printed in colour, **two screenshots per page**, each named after its screen
  (Chapter II and Section 3.5, Output Screens).
- **Page numbers:** "Page N of M" from the cover (page 1) onwards. The table of contents starts from the
  Executive Summary (the abstract).

| File | What it is |
|---|---|
| `MathMe_Internship_Report.pdf` | The finished report: 59 pages |
| `MathMe_Internship_Report.docx` | The same report in Word, to fill in and edit |

## Fill in before you submit
The report leaves these as blanks (`____`); the content does not make them up:
- Your register number.
- The college, university, guide, head of department and principal.
- The internship dates.
- The hours in the weekly log (Table 3.1).
- The signatures and seal on the two certificates.

Type them into the Word file, then save it as PDF from Word (File → Save As → PDF).

If you edit the Word file a lot, the page numbers in the Contents, List of Figures and List of Tables may change.
Check them before printing.

## Rebuilding the report
Everything is generated from `content/` (the text), `img/` (real screenshots of MathMe) and `diagrams.mjs`
(the diagrams).

```bash
cd docs/internship-report
npm install
npm run capture   # optional: new screenshots (builds the app and starts the services; needs their .venv folders)
npm run build     # diagrams → PDF → Word
```

The build needs:
- Node 22, with the web app's dependencies installed (for Playwright's Chromium);
- `pdftotext` (Poppler);
- LibreOffice Writer (`soffice`), used to find the Word page numbers for the contents.
- the Times New Roman font installed (Microsoft core fonts), so the PDF embeds it.

| Script | Job |
|---|---|
| `capture.mjs` | Opens MathMe in Chromium and takes the screenshots in `img/` |
| `diagrams.mjs`, `rasterize.mjs` | Draw the architecture, DFD, ER, use-case, module and sequence diagrams (SVG, plus PNG for Word) |
| `build-pdf.mjs` | Prints the report with Chromium, fills in the contents page numbers, adds the borders and page numbers |
| `build-docx.mjs` | Writes the Word file from the same content (two passes for the contents page numbers) |
