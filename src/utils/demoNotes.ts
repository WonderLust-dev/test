import { StudyNote } from '../types';

export const DEMO_NOTES: Array<Omit<StudyNote, 'id' | 'created_at' | 'updated_at'>> = [
  {
    user_id: 'guest',
    title: 'SSC CGL Mathematics & Algebra Speed Formulas',
    file_name: 'SSC_Math_Formulas_Speed_Shortcuts.md',
    file_type: 'md',
    subject: 'Quantitative Aptitude',
    topic: 'Algebra & Geometry',
    tags: ['Formulas', 'Algebra', 'Trigonometry', 'Shortcuts', 'High Yield'],
    file_size: 3420,
    is_pinned: true,
    content: `# SSC CGL Quantitative Aptitude — Essential Formulas & Speed Shortcuts

> [!TIP]
> Revise these formulas every morning before attempting mock tests. In SSC CGL Tier 1 & 2, direct application of these identities saves 15–20 minutes.

---

## 1. Algebra Master Identities

### Symmetrical Expressions
- **When $a + b + c = 0$:**
  $$a^3 + b^3 + c^3 = 3abc$$
- **Standard Cubic Expansion:**
  $$a^3 + b^3 + c^3 - 3abc = (a + b + c)(a^2 + b^2 + c^2 - ab - bc - ca)$$
- **Alternative Half-Form (frequently tested):**
  $$a^3 + b^3 + c^3 - 3abc = \\frac{1}{2}(a + b + c)[(a - b)^2 + (b - c)^2 + (c - a)^2]$$

### Reciprocal Relations ($x + \\frac{1}{x} = k$)
| Given Value | Target Expression | Shortcut Formula | Example ($k=3$) |
| :--- | :--- | :--- | :--- |
| $x + \\frac{1}{x} = k$ | $x^2 + \\frac{1}{x^2}$ | $k^2 - 2$ | $3^2 - 2 = 7$ |
| $x - \\frac{1}{x} = k$ | $x^2 + \\frac{1}{x^2}$ | $k^2 + 2$ | $3^2 + 2 = 11$ |
| $x + \\frac{1}{x} = k$ | $x^3 + \\frac{1}{x^3}$ | $k^3 - 3k$ | $27 - 9 = 18$ |
| $x - \\frac{1}{x} = k$ | $x^3 - \\frac{1}{x^3}$ | $k^3 + 3k$ | $27 + 9 = 36$ |
| $x + \\frac{1}{x} = k$ | $x - \\frac{1}{x}$ | $\\pm\\sqrt{k^2 - 4}$ | $\\sqrt{9 - 4} = \\sqrt{5}$ |

---

## 2. Geometry & Triangles Quick Reference

### Inradius & Circumradius Formulas
- **Right-angled Triangle:**
  - Circumradius: $R = \\frac{\\text{Hypotenuse}}{2}$
  - Inradius: $r = \\frac{P + B - H}{2}$
- **Equilateral Triangle ($a$ = side length):**
  - Height: $h = \\frac{\\sqrt{3}}{2}a$
  - Inradius: $r = \\frac{a}{2\\sqrt{3}}$
  - Circumradius: $R = \\frac{a}{\\sqrt{3}}$
  - Ratio of Areas: $\\text{Incircle Area} : \\text{Circumcircle Area} = 1 : 4$

\`\`\`
          A
         / \\
        /   \\
       /     \\
      /   O   \\      O = Incenter / Circumcenter
     /         \\
    B-----------C
\`\`\`

> [!NOTE]
> For any cyclic quadrilateral $ABCD$, opposite angles sum to $180^\\circ$ ($\angle A + \angle C = 180^\\circ$).

---

## 3. Trigonometry Standard Table

| Angle | $0^\\circ$ | $30^\\circ$ | $45^\\circ$ | $60^\\circ$ | $90^\\circ$ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| $\\sin \\theta$ | $0$ | $\\frac{1}{2}$ | $\\frac{1}{\\sqrt{2}}$ | $\\frac{\\sqrt{3}}{2}$ | $1$ |
| $\\cos \\theta$ | $1$ | $\\frac{\\sqrt{3}}{2}$ | $\\frac{1}{\\sqrt{2}}$ | $\\frac{1}{2}$ | $0$ |
| $\\tan \\theta$ | $0$ | $\\frac{1}{\\sqrt{3}}$ | $1$ | $\\sqrt{3}$ | $\\infty$ |

### Complementary Angle Pairs (If $\\alpha + \\beta = 90^\\circ$)
- $\\sin \\alpha = \\cos \\beta$
- $\\tan \\alpha \\cdot \\tan \\beta = 1$
- $\\sin^2 \\alpha + \\sin^2 \\beta = 1$

---

## 4. Arithmetic Speed Tricks

- [x] **CI & SI 2-Year Difference:** $\\text{Diff} = P \\left(\\frac{R}{100}\\right)^2$
- [x] **CI & SI 3-Year Difference:** $\\text{Diff} = P \\left(\\frac{R}{100}\\right)^2 \\left(3 + \\frac{R}{100}\\right)$
- [x] **Successive Percentage Change:** $A + B + \\frac{AB}{100}$
- [ ] **Direct Common Tangent (DCT):** $\\sqrt{d^2 - (r_1 - r_2)^2}$
- [ ] **Transverse Common Tangent (TCT):** $\\sqrt{d^2 - (r_1 + r_2)^2}$
`,
  },
  {
    user_id: 'guest',
    title: 'Indian Polity & Constitution — Comprehensive Fast Revision',
    file_name: 'Indian_Polity_Constitution_Revision.md',
    file_type: 'md',
    subject: 'General Awareness',
    topic: 'Indian Polity',
    tags: ['Polity', 'Constitution', 'Articles', 'Amendments', 'GK'],
    file_size: 2850,
    is_pinned: true,
    content: `# Indian Polity & Constitution — Quick Revision Guide

> [!IMPORTANT]
> Articles 12–35 (Fundamental Rights) and Articles 52–78 (The Union Executive) account for over 60% of Polity questions in SSC CGL.

---

## 1. Fundamental Rights Overview (Part III, Articles 12–35)

The Constitution of India guarantees 6 Fundamental Rights to all citizens:

1. **Right to Equality (Articles 14–18)**
   - **Art. 14:** Equality before Law & Equal Protection of Laws
   - **Art. 15:** Prohibition of discrimination on grounds of religion, race, caste, sex, or place of birth
   - **Art. 16:** Equality of opportunity in matters of public employment
   - **Art. 17:** Abolition of Untouchability *(Direct SSC favorite)*
   - **Art. 18:** Abolition of Titles (except military & academic)

2. **Right to Freedom (Articles 19–22)**
   - **Art. 19(1):** Six fundamental democratic freedoms (Speech, Assembly, Association, Movement, Residence, Profession)
   - **Art. 21:** Protection of Life & Personal Liberty (Right to Privacy under Puttaswamy judgment)
   - **Art. 21A:** Right to Free & Compulsory Elementary Education (added by 86th Amendment, 2002)

3. **Right against Exploitation (Articles 23–24)**
   - **Art. 23:** Prohibition of traffic in human beings and forced labor
   - **Art. 24:** Prohibition of employment of children in hazardous industries (under 14 years)

4. **Right to Freedom of Religion (Articles 25–28)**
5. **Cultural & Educational Rights (Articles 29–30)**
6. **Right to Constitutional Remedies (Article 32)**
   - Termed by Dr. B.R. Ambedkar as the *"Heart and Soul of the Constitution"*.

---

## 2. The 5 Constitutional Writs (Articles 32 & 226)

| Writ | Latin Meaning | Purpose | Scope |
| :--- | :--- | :--- | :--- |
| **Habeas Corpus** | "To have the body of" | Protects against unlawful or arbitrary detention | Against public and private bodies |
| **Mandamus** | "We command" | Directs a public official or body to perform a duty | Against public authorities only |
| **Prohibition** | "To forbid" | Prevents a lower court from exceeding jurisdiction | Against judicial & quasi-judicial bodies |
| **Certiorari** | "To be certified" | Quashes order of an inferior court or tribunal | Judicial & administrative bodies |
| **Quo-Warranto** | "By what authority?" | Prevents illegal usurpation of a public office | Substantive public offices |

---

## 3. Crucial Constitutional Amendments

- **42nd Amendment (1976) — "Mini Constitution":**
  - Added words **Socialist, Secular, and Integrity** to Preamble.
  - Added Part IVA (Fundamental Duties, Art. 51A) on recommendation of Swaran Singh Committee.
- **44th Amendment (1978):**
  - Removed Right to Property (Art. 31) from Fundamental Rights; made it a legal right under Art. 300A.
  - Replaced "Internal Disturbance" with "Armed Rebellion" for National Emergency (Art. 352).
- **61st Amendment (1989):** Lowered voting age from 21 to 18 years (Art. 326).
- **73rd & 74th Amendments (1992):** Constitutional status to Panchayati Raj (11th Schedule) and Municipalities (12th Schedule).
- **101st Amendment (2016):** Goods and Services Tax (GST).
`,
  },
  {
    user_id: 'guest',
    title: 'High-Frequency English Vocabulary & One-Word Substitutions',
    file_name: 'SSC_English_Vocabulary_One_Word.txt',
    file_type: 'txt',
    subject: 'English Comprehension',
    topic: 'Vocabulary',
    tags: ['English', 'Vocabulary', 'One Word', 'Idioms'],
    file_size: 1980,
    is_pinned: false,
    content: `================================================================================
SSC CGL REVISION NOTES: HIGH-FREQUENCY ONE-WORD SUBSTITUTIONS & IDIOMS
================================================================================

PART 1: GOVERNMENTS & SYSTEMS OF RULE
--------------------------------------------------------------------------------
1. Plutocracy   : Government by the wealthy class.
2. Oligarchy    : Government by a small group of people.
3. Aristocracy  : Government by the noble or upper class.
4. Autocracy    : Government by one person with unlimited authority.
5. Theocracy    : Government by religious leaders according to divine guidance.
6. Gerontocracy : Government by old people.
7. Anarchy      : Total absence of government and law and order.

PART 2: PHOBIAS (IRRATIONAL FEARS)
--------------------------------------------------------------------------------
1. Claustrophobia : Extreme fear of confined or enclosed spaces.
2. Agoraphobia    : Fear of crowded, open public spaces.
3. Acrophobia     : Extreme fear of heights.
4. Hydrophobia    : Extreme fear of water (associated with rabies).
5. Glossophobia   : Fear of public speaking.
6. Xenophobia     : Fear or hatred of strangers or foreigners.
7. Bibliophobia   : Fear or hatred of books.

PART 3: HIGH-YIELD IDIOMS & PHRASES
--------------------------------------------------------------------------------
1. "Bite the bullet"
   Meaning: To face a difficult situation with courage and fortitude.
   Context: SSC CGL 2022 Tier 1 repeated question.

2. "Burn the midnight oil"
   Meaning: To study or work late into the night.

3. "At the eleventh hour"
   Meaning: At the very last possible moment.

4. "Through thick and thin"
   Meaning: In good times and in bad times; under all circumstances.

5. "Spill the beans"
   Meaning: To reveal a secret prematurely or untruthfully.

6. "A hard nut to crack"
   Meaning: A difficult problem or a person who is not easy to convince.

7. "Take with a grain of salt"
   Meaning: To view something with skepticism or not accept it as completely true.

================================================================================
Tip: Revise root words like "Cide" (killing), "Phil" (love), "Mis" (hate).
================================================================================
`,
  },
];
