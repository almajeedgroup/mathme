// Front matter: cover, certificates, declaration, acknowledgement, contents (pages without numbers).
import { BLANK, BREAK, CENTER, LOF, LOGO, LOT, P, SHORT, SIGNS, SPACE, TITLE, TOC } from './blocks.mjs';

export const PROJECT = 'MATHME 3D STUDIO';
export const SUBTITLE = 'Generative 3D Art & Object Studio';
export const STUDENT = 'SULAIMAAN';

export const front = [
  // ---------------------------------------------------------------- 1. cover page
  { t: 'page', kind: 'cover' },
  SPACE(10),
  CENTER('AN INTERNSHIP PROJECT REPORT', { size: 18, bold: true }),
  CENTER('ON', { size: 13, bold: true }),
  SPACE(2),
  CENTER(`“${PROJECT}”`, { size: 24, bold: true }),
  CENTER(SUBTITLE, { size: 15, italic: true }),
  SPACE(5),
  CENTER('Submitted in partial fulfilment of the requirements for the award of the degree of', { size: 12 }),
  CENTER('BACHELOR OF COMPUTER APPLICATIONS (BCA)', { size: 14, bold: true }),
  CENTER('Semester III', { size: 13, bold: true }),
  SPACE(5),
  CENTER('Submitted by', { size: 12, italic: true }),
  CENTER(STUDENT, { size: 17, bold: true }),
  CENTER(`Register Number: ${BLANK}`, { size: 12 }),
  SPACE(5),
  LOGO(40),
  SPACE(7),
  CENTER('Under the guidance of', { size: 12, italic: true }),
  CENTER(`${BLANK}${SHORT}`, { size: 12 }),
  CENTER(`Designation: ${BLANK}`, { size: 12 }),
  SPACE(6),
  CENTER('DEPARTMENT OF COMPUTER APPLICATIONS', { size: 13, bold: true }),
  CENTER(`[Name of the College] ${SHORT}${SHORT}`, { size: 12 }),
  CENTER(`[Affiliated University] ${SHORT}${SHORT}`, { size: 12 }),
  CENTER('Academic Year 2026 – 2027', { size: 13, bold: true }),
  BREAK,

  // ---------------------------------------------------------------- 2. internship certificate
  { t: 'page', kind: 'front' },
  SPACE(4),
  TITLE('INTERNSHIP CERTIFICATE'),
  SPACE(4),
  P(
    `This is to certify that **${STUDENT}**, Register Number ${BLANK}, a student of the Third Semester of the Bachelor of Computer Applications (BCA) programme, has successfully completed the internship project titled **“${PROJECT}: ${SUBTITLE}”** as an independent internship project.`,
  ),
  P(
    `The internship was carried out on a part-time basis for a total of **90 hours** over **10 weeks**, from ${SHORT} to ${SHORT}. During this period the student analysed, designed, developed, tested and documented the MathMe web application described in this report.`,
  ),
  P(
    'The work presented in this report is a record of the work done by the student, and the conduct of the student during the internship was found to be satisfactory.',
  ),
  SPACE(10),
  P(`Place: ${SHORT}`, { noIndent: true }),
  P(`Date: ${SHORT}`, { noIndent: true }),
  SPACE(14),
  SIGNS([
    ['Signature of the Internship Guide / Mentor', `Name: ${SHORT}`],
    ['Seal', ''],
  ]),
  BREAK,

  // ---------------------------------------------------------------- 3. college certificate
  { t: 'page', kind: 'front' },
  CENTER('[NAME OF THE COLLEGE]', { size: 15, bold: true }),
  CENTER(`[Address of the College] ${SHORT}`, { size: 12 }),
  CENTER('DEPARTMENT OF COMPUTER APPLICATIONS', { size: 13, bold: true }),
  SPACE(6),
  TITLE('CERTIFICATE'),
  SPACE(4),
  P(
    `This is to certify that the internship project report entitled **“${PROJECT}: ${SUBTITLE}”** is a bonafide record of the internship work carried out by **${STUDENT}**, Register Number ${BLANK}, in partial fulfilment of the requirements for the Third Semester of the **Bachelor of Computer Applications (BCA)** degree of ${BLANK}${SHORT} during the academic year **2026 – 2027**.`,
  ),
  P(
    'It is certified that all corrections and suggestions indicated during the internal assessment have been incorporated in the report. The report satisfies the academic requirements prescribed for the internship.',
  ),
  SPACE(18),
  SIGNS([
    ['Signature of the Guide', `Name: ${SHORT}`],
    ['Signature of the Head of the Department', `Name: ${SHORT}`],
  ]),
  SPACE(14),
  SIGNS([['Signature of the Principal', `Name: ${SHORT}`]]),
  SPACE(12),
  P('**Examiners**', { noIndent: true, center: true }),
  SPACE(6),
  SIGNS([
    ['1. Examiner', `Name: ${SHORT}`],
    ['2. Examiner', `Name: ${SHORT}`],
  ]),
  BREAK,

  // ---------------------------------------------------------------- 4. student declaration
  { t: 'page', kind: 'front' },
  SPACE(6),
  TITLE('STUDENT DECLARATION'),
  SPACE(4),
  P(
    `I, **${STUDENT}**, Register Number ${BLANK}, a student of the Third Semester of the Bachelor of Computer Applications (BCA) programme, hereby declare that the internship project report entitled **“${PROJECT}: ${SUBTITLE}”** is an original record of the work carried out by me as an independent internship project, under the guidance of ${BLANK}${SHORT}.`,
  ),
  P(
    'I further declare that this report is based on my own work, that it has not been submitted earlier to any other university or institution for the award of any degree, diploma or certificate, and that all sources of information used in this report have been duly acknowledged in the bibliography.',
  ),
  SPACE(18),
  P(`Place: ${SHORT}`, { noIndent: true }),
  P(`Date: ${SHORT}`, { noIndent: true }),
  SPACE(10),
  SIGNS([['', `(${STUDENT})`]]),
  BREAK,

  // ---------------------------------------------------------------- 5. acknowledgement
  { t: 'page', kind: 'front' },
  SPACE(4),
  TITLE('ACKNOWLEDGEMENT'),
  SPACE(3),
  P(
    'The successful completion of this internship project would not have been possible without the guidance, support and encouragement of many people. I take this opportunity to express my sincere gratitude to all of them.',
  ),
  P(
    `I express my deep sense of gratitude to ${BLANK}, Principal, ${BLANK}, for providing the necessary facilities and an encouraging environment to carry out this internship.`,
  ),
  P(
    `I am thankful to ${BLANK}, Head of the Department of Computer Applications, for the constant support and for giving me the opportunity to take up this internship project.`,
  ),
  P(
    `I owe my sincere thanks to my internship guide, ${BLANK}, for the valuable guidance, timely suggestions and patient reviews at every stage of this work, from the first idea to the final report.`,
  ),
  P(
    'I also thank all the teaching and non-teaching staff of the Department of Computer Applications for their help and cooperation throughout the internship period.',
  ),
  P(
    'I am grateful to the open-source communities behind React, Three.js, Mantine, FastAPI, trimesh and manifold3d, whose tools and documentation made this project possible, and to the HuBMAP consortium for making the Human Reference Atlas heart model freely available for education.',
  ),
  P(
    'Finally, I thank my parents, family members and friends for their love, patience and constant encouragement, which kept me motivated throughout this internship.',
  ),
  SPACE(14),
  SIGNS([['', `(${STUDENT})`]]),
  BREAK,

  // ---------------------------------------------------------------- 6. contents
  { t: 'page', kind: 'front' },
  TITLE('TABLE OF CONTENTS'),
  TOC,
  BREAK,
  { t: 'page', kind: 'front' },
  TITLE('LIST OF FIGURES'),
  LOF,
  BREAK,
  { t: 'page', kind: 'front' },
  TITLE('LIST OF TABLES'),
  LOT,
];
