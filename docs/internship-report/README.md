# MathMe internship project report

The internship project report for **MathMe 3D Studio**, by Sulaimaan (BCA, Semester III). It follows the internship
report format of the Bengaluru North University BCA syllabus (course CA5P3):
- **Parts, in order:** cover, internship certificate, college certificate, student declaration, acknowledgement,
  contents, executive summary, Chapters I–IV, bibliography.
- **Page format:** A4, Times New Roman, 1.5 line spacing.
- **Look:** double page borders and "Page N of M".

| File | What it is |
|---|---|
| `MathMe_Internship_Report.pdf` | The finished report: 60 pages (9 front pages + 51 numbered pages) |
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

| Script | Job |
|---|---|
| `capture.mjs` | Opens MathMe in Chromium and takes the screenshots in `img/` |
| `diagrams.mjs`, `rasterize.mjs` | Draw the architecture, DFD, ER, use-case, module and sequence diagrams (SVG, plus PNG for Word) |
| `build-pdf.mjs` | Prints the report with Chromium, fills in the contents page numbers, adds the borders and page numbers |
| `build-docx.mjs` | Writes the Word file from the same content (two passes for the contents page numbers) |
