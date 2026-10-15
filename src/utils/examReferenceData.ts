// ============================================================
// Comprehensive Examination & Schema Reference Data
// ============================================================

export interface ExamPreset {
  id: string;
  name: string;
  category: 'SSC' | 'Railway' | 'Banking & Insurance' | 'UPSC & Defence' | 'State PSC' | 'Teaching' | 'Custom';
  badge: string;
  defaultDuration: number; // in minutes
  defaultMarks: number;
  defaultNegative: number;
  defaultQuestions: number;
  subjects: string[];
  popularTopics: Record<string, string[]>;
  description: string;
  markingRule: string;
}

export const EXAM_PRESETS: ExamPreset[] = [
  // --- SSC Category ---
  {
    id: 'ssc_cgl',
    name: 'SSC CGL (Combined Graduate Level — Tier 1 & 2)',
    category: 'SSC',
    badge: 'Graduate',
    defaultDuration: 60,
    defaultMarks: 2,
    defaultNegative: 0.5,
    defaultQuestions: 25,
    subjects: [
      'Quantitative Aptitude',
      'General Intelligence & Reasoning',
      'English Comprehension',
      'General Awareness',
      'Computer Knowledge',
      'Statistics',
    ],
    popularTopics: {
      'Quantitative Aptitude': [
        'Percentage & Profit-Loss',
        'Time, Speed & Distance',
        'Time & Work',
        'Simple & Compound Interest',
        'Ratio, Proportion & Mixture',
        'Algebra & Polynomials',
        'Trigonometry & Heights-Distances',
        'Geometry (Triangles & Circles)',
        'Mensuration (2D & 3D)',
        'Number System & HCF-LCM',
        'Data Interpretation',
      ],
      'General Intelligence & Reasoning': [
        'Analogy & Classification',
        'Coding-Decoding',
        'Blood Relations',
        'Direction & Distance Sense',
        'Syllogism (Venn Diagrams)',
        'Series (Number & Alphabet)',
        'Non-Verbal (Paper Folding & Mirrors)',
        'Matrix & Embedded Figures',
        'Order, Ranking & Seating',
      ],
      'English Comprehension': [
        'Reading Comprehension (Passages)',
        'Cloze Test',
        'Spotting the Error (Grammar)',
        'Sentence Improvement',
        'Synonyms & Antonyms',
        'One Word Substitution',
        'Idioms & Phrases',
        'Active-Passive Voice',
        'Direct-Indirect Speech',
      ],
      'General Awareness': [
        'Indian Polity & Constitution',
        'Modern Indian History',
        'Geography (Physical & Indian)',
        'Economics & Five-Year Plans',
        'Physics, Chemistry & Biology',
        'Current Affairs & Summits',
        'Static GK (Art, Dance & Awards)',
      ],
      'Computer Knowledge': [
        'Computer Basics & Architecture',
        'Operating Systems & Networking',
        'MS Office (Word, Excel, PPT)',
        'Cyber Security & Viruses',
        'Internet & Protocols',
      ],
      'Statistics': [
        'Measures of Central Tendency',
        'Dispersion & Skewness',
        'Correlation & Regression',
        'Probability Theory',
      ],
    },
    description: 'Premier central government recruitment exam for Group B & C officers.',
    markingRule: '+2 for correct, -0.5 for wrong (Tier 1) / +3 for correct, -1.0 for wrong (Tier 2)',
  },
  {
    id: 'ssc_chsl',
    name: 'SSC CHSL (Combined Higher Secondary Level 10+2)',
    category: 'SSC',
    badge: '10+2 Level',
    defaultDuration: 60,
    defaultMarks: 2,
    defaultNegative: 0.5,
    defaultQuestions: 25,
    subjects: [
      'Quantitative Aptitude (Basic Arithmetic)',
      'General Intelligence',
      'English Language',
      'General Awareness',
    ],
    popularTopics: {
      'Quantitative Aptitude (Basic Arithmetic)': ['Percentages', 'Ratio & Proportion', 'Averages', 'Simple Interest', 'Profit & Loss', 'Basic Algebra', 'Standard Mensuration'],
      'General Intelligence': ['Analogy', 'Number Series', 'Coding-Decoding', 'Venn Diagrams', 'Paper Folding'],
      'English Language': ['Spotting Errors', 'Fill in the Blanks', 'Synonyms/Antonyms', 'Idioms & Phrases', 'Active/Passive'],
      'General Awareness': ['Indian History & Culture', 'Geography', 'General Science', 'Current Affairs'],
    },
    description: 'LDC, JSA, and Data Entry Operator recruitment exam for 10+2 candidates.',
    markingRule: '+2 for correct, -0.5 for wrong',
  },
  {
    id: 'ssc_mts',
    name: 'SSC MTS & Havaldar (Multi-Tasking Staff)',
    category: 'SSC',
    badge: 'Matriculation',
    defaultDuration: 45,
    defaultMarks: 3,
    defaultNegative: 1.0,
    defaultQuestions: 25,
    subjects: [
      'Numerical & Mathematical Ability',
      'Reasoning Ability & Problem Solving',
      'General Awareness',
      'English Language & Comprehension',
    ],
    popularTopics: {
      'Numerical & Mathematical Ability': ['LCM & HCF', 'Decimals & Fractions', 'Percentages', 'Ratio & Proportions', 'Time and Work'],
      'Reasoning Ability & Problem Solving': ['Alphanumeric Series', 'Coding and Decoding', 'Analogy', 'Directions', 'Similarities and Differences'],
      'General Awareness': ['Social Studies', 'General Science', 'Environmental Studies', 'Current Affairs'],
      'English Language & Comprehension': ['Basic Grammar', 'Vocabulary', 'Sentence Structure', 'Simple Comprehension'],
    },
    description: 'National recruitment for General Central Service Group C non-gazetted posts.',
    markingRule: '+3 for correct, -1 for wrong (Session 2)',
  },
  {
    id: 'ssc_cpo',
    name: 'SSC CPO (Sub-Inspector in Delhi Police & CAPFs)',
    category: 'SSC',
    badge: 'Police / Defence',
    defaultDuration: 120,
    defaultMarks: 1,
    defaultNegative: 0.25,
    defaultQuestions: 50,
    subjects: [
      'General Intelligence & Reasoning',
      'General Knowledge & General Awareness',
      'Quantitative Aptitude',
      'English Comprehension',
    ],
    popularTopics: {
      'General Intelligence & Reasoning': ['Syllogism', 'Puzzles', 'Coding-Decoding', 'Blood Relations', 'Matrix'],
      'General Knowledge & General Awareness': ['Indian Constitution', 'History', 'Geography', 'National & International Current Affairs'],
      'Quantitative Aptitude': ['Number System', 'Trigonometry', 'Geometry', 'Algebra', 'Commercial Math'],
      'English Comprehension': ['Reading Comprehension', 'Sentence Correction', 'Grammar Rules', 'Vocabulary'],
    },
    description: 'Direct recruitment for Sub-Inspectors in Delhi Police, BSF, CISF, CRPF, ITBP, and SSB.',
    markingRule: '+1 for correct, -0.25 for wrong',
  },
  {
    id: 'ssc_gd',
    name: 'SSC GD Constable (Paramilitary & Rifleman)',
    category: 'SSC',
    badge: '10th Level',
    defaultDuration: 60,
    defaultMarks: 2,
    defaultNegative: 0.25,
    defaultQuestions: 20,
    subjects: [
      'General Intelligence and Reasoning',
      'General Knowledge and General Awareness',
      'Elementary Mathematics',
      'English / Hindi Language',
    ],
    popularTopics: {
      'General Intelligence and Reasoning': ['Analogies', 'Spatial Orientation', 'Visual Memory', 'Arithmetical Reasoning'],
      'General Knowledge and General Awareness': ['Sports', 'History', 'Culture', 'Geography', 'Economic Scene'],
      'Elementary Mathematics': ['Number Systems', 'Whole Numbers', 'Decimals', 'Fractions', 'Time and Distance'],
      'English / Hindi Language': ['Basic Comprehension', 'Error Recognition', 'Vocabulary', 'Grammar'],
    },
    description: 'Constable recruitment in Central Armed Police Forces (CAPFs), SSF, and Assam Rifles.',
    markingRule: '+2 for correct, -0.25 for wrong',
  },

  // --- Railway (RRB) Category ---
  {
    id: 'rrb_ntpc',
    name: 'RRB NTPC (Non-Technical Popular Categories — CBT 1 & 2)',
    category: 'Railway',
    badge: 'Railways',
    defaultDuration: 90,
    defaultMarks: 1,
    defaultNegative: 0.33,
    defaultQuestions: 30,
    subjects: [
      'General Awareness',
      'Mathematics',
      'General Intelligence and Reasoning',
    ],
    popularTopics: {
      'General Awareness': ['Current Events', 'Indian Railways GK', 'General Science & Life Sciences', 'Monuments & Places of India', 'Indian Polity & Governance'],
      'Mathematics': ['Number System', 'Decimals & Fractions', 'LCM & HCF', 'Ratio & Proportions', 'Time & Work', 'Time & Distance', 'Elementary Algebra & Geometry'],
      'General Intelligence and Reasoning': ['Analogies', 'Completion of Number and Alphabetical Series', 'Coding and Decoding', 'Mathematical Operations', 'Venn Diagrams', 'Data Interpretation'],
    },
    description: 'Station Master, Goods Guard, Commercial Apprentice, and Traffic Assistant recruitment.',
    markingRule: '+1 for correct, -0.33 (1/3rd) for wrong',
  },
  {
    id: 'rrb_group_d',
    name: 'RRB Group D (RRC Level 1)',
    category: 'Railway',
    badge: 'Railways Level 1',
    defaultDuration: 90,
    defaultMarks: 1,
    defaultNegative: 0.33,
    defaultQuestions: 25,
    subjects: [
      'General Science (Physics, Chemistry, Biology)',
      'Mathematics',
      'General Intelligence and Reasoning',
      'General Awareness and Current Affairs',
    ],
    popularTopics: {
      'General Science (Physics, Chemistry, Biology)': ['Newton Laws', 'Periodic Table', 'Human Physiology', 'Electricity & Magnetism', 'Acids, Bases & Salts'],
      'Mathematics': ['BODMAS', 'Decimals & Percentages', 'Mensuration', 'Simple & Compound Interest', 'Algebra'],
      'General Intelligence and Reasoning': ['Analogies', 'Direction Sense', 'Statement & Arguments', 'Classification'],
      'General Awareness and Current Affairs': ['Science & Tech', 'Sports', 'Culture', 'Personalities', 'Economics'],
    },
    description: 'Track Maintainer, Assistant Pointsman, and technical assistant recruitment in Indian Railways.',
    markingRule: '+1 for correct, -0.33 for wrong',
  },
  {
    id: 'rrb_alp',
    name: 'RRB ALP & Technician (Assistant Loco Pilot)',
    category: 'Railway',
    badge: 'Technical',
    defaultDuration: 60,
    defaultMarks: 1,
    defaultNegative: 0.33,
    defaultQuestions: 20,
    subjects: [
      'Mathematics',
      'General Intelligence & Reasoning',
      'General Science',
      'Basic Science and Engineering',
      'General Awareness on Current Affairs',
    ],
    popularTopics: {
      'Basic Science and Engineering': ['Engineering Drawing', 'Units & Measurements', 'Work, Power & Energy', 'Speed & Velocity', 'Heat & Temperature', 'Basic Electricity'],
      'Mathematics': ['Trigonometry', 'Square Root', 'Age Calculations', 'Calendar & Clock', 'Pipes & Cistern'],
      'General Intelligence & Reasoning': ['Syllogism', 'Jumbling', 'Venn Diagram', 'Data Sufficiency'],
      'General Science': ['10th Standard CBSE Physics, Chemistry, Biology'],
    },
    description: 'Driver/Loco Pilot and technical assistant posts across Indian Railway zones.',
    markingRule: '+1 for correct, -0.33 for wrong',
  },

  // --- Banking & Insurance Category ---
  {
    id: 'ibps_sbi_po',
    name: 'IBPS PO / SBI PO (Probationary Officer Prelims & Mains)',
    category: 'Banking & Insurance',
    badge: 'Banking Officer',
    defaultDuration: 60,
    defaultMarks: 1,
    defaultNegative: 0.25,
    defaultQuestions: 35,
    subjects: [
      'Quantitative Aptitude & Data Interpretation',
      'Reasoning Ability & High-Level Puzzles',
      'English Language',
      'General & Banking Awareness',
      'Computer Aptitude',
    ],
    popularTopics: {
      'Quantitative Aptitude & Data Interpretation': [
        'Data Interpretation (Table, Bar, Pie, Radar & Caselet)',
        'Approximation & Simplification',
        'Quadratic Equations & Inequalities',
        'Wrong & Missing Number Series',
        'Arithmetic Word Problems (Ages, Mixtures, SI/CI, TSD)',
      ],
      'Reasoning Ability & High-Level Puzzles': [
        'Floor & Flat Puzzles',
        'Circular & Linear Seating Arrangement',
        'Box Puzzles & Scheduling',
        'Coding-Decoding (New Pattern)',
        'Syllogism (Only a Few & Reverse)',
        'Input-Output Machine',
        'Critical Reasoning & Inferences',
      ],
      'English Language': [
        'Reading Comprehension (Financial/Editorial)',
        'Cloze Test (New Pattern)',
        'Error Detection (Multiple sentence)',
        'Phrase Replacement',
        'Word Swap & Column Matching',
      ],
      'General & Banking Awareness': [
        'Monetary Policy & RBI Updates',
        'Banking Terminology & Basel Norms',
        'Priority Sector Lending (PSL)',
        'Economic Survey & Union Budget',
        'National & International Affairs',
      ],
    },
    description: 'Assistant Manager / Probationary Officer exam for SBI and 11 public sector banks.',
    markingRule: '+1 for correct, -0.25 for wrong',
  },
  {
    id: 'ibps_sbi_clerk',
    name: 'IBPS Clerk / SBI Clerk (Junior Associates)',
    category: 'Banking & Insurance',
    badge: 'Bank Clerk',
    defaultDuration: 60,
    defaultMarks: 1,
    defaultNegative: 0.25,
    defaultQuestions: 30,
    subjects: [
      'Numerical Ability',
      'Reasoning Ability',
      'English Language',
      'General / Financial Awareness',
    ],
    popularTopics: {
      'Numerical Ability': ['Simplification & Approximation', 'Missing Number Series', 'Simple DI (Line & Bar)', 'Arithmetic Applications'],
      'Reasoning Ability': ['Seating Arrangements', 'Puzzles', 'Inequality', 'Syllogism', 'Blood Relations', 'Direction Sense'],
      'English Language': ['Reading Comprehension', 'Sentence Rearrangement', 'Grammar & Usage', 'Spell Checks'],
      'General / Financial Awareness': ['Current Affairs (last 6 months)', 'Banking & Financial Terms', 'Static GK'],
    },
    description: 'Clerical Cadre / Customer Support Associates across public sector banks.',
    markingRule: '+1 for correct, -0.25 for wrong',
  },
  {
    id: 'rbi_grade_b',
    name: 'RBI Grade B Officer (Phase 1 & Phase 2)',
    category: 'Banking & Insurance',
    badge: 'Central Bank',
    defaultDuration: 120,
    defaultMarks: 1,
    defaultNegative: 0.25,
    defaultQuestions: 40,
    subjects: [
      'General Awareness (Economic & Financial focus)',
      'Reasoning',
      'English Language',
      'Quantitative Aptitude',
      'Economic & Social Issues (ESI)',
      'Finance & Management (FM)',
    ],
    popularTopics: {
      'General Awareness (Economic & Financial focus)': ['RBI Notifications', 'Macroeconomic Indicators', 'Union Budget', 'Global Financial Institutions'],
      'Economic & Social Issues (ESI)': ['Growth & Development', 'Indian Economy History', 'Social Structure & Demography', 'Poverty Alleviation'],
      'Finance & Management (FM)': ['Financial System & Markets', 'Corporate Governance', 'Leadership & Motivation', 'Fintech Trends'],
    },
    description: 'Managerial entry-level recruitment in Reserve Bank of India.',
    markingRule: '+1 for correct, -0.25 for wrong',
  },

  // --- UPSC & Defence Category ---
  {
    id: 'upsc_prelims_gs1',
    name: 'UPSC CSE Prelims (Civil Services — GS Paper 1)',
    category: 'UPSC & Defence',
    badge: 'Civil Services',
    defaultDuration: 120,
    defaultMarks: 2,
    defaultNegative: 0.66,
    defaultQuestions: 25,
    subjects: [
      'Indian Polity & Governance',
      'History of India & National Movement',
      'Indian and World Geography',
      'Economic & Social Development',
      'Environment, Ecology & Climate Change',
      'General Science & Emerging Tech',
      'Current Events of National & International Importance',
    ],
    popularTopics: {
      'Indian Polity & Governance': ['Preamble & Fundamental Rights', 'Directive Principles & Duties', 'Parliament & State Legislatures', 'Judiciary & Judicial Review', 'Constitutional Bodies & Amendments'],
      'History of India & National Movement': ['Ancient & Medieval Art/Architecture', 'Bhakti & Sufi Movements', 'Freedom Struggle & Gandhian Era', 'Socio-Religious Reform Movements', 'Governor-Generals & Acts'],
      'Indian and World Geography': ['Geomorphology & Climatology', 'River Systems of India', 'Mineral Resources & Agriculture', 'Oceanography', 'Map-based locations'],
      'Environment, Ecology & Climate Change': ['Biodiversity & Hotspots', 'National Parks & Wildlife Sanctuaries', 'International Conventions (UNFCCC, Ramsar, CBD)', 'Pollution & Conservation Initiatives'],
      'Economic & Social Development': ['Monetary & Fiscal Policies', 'Inflation & Indices', 'Balance of Payments & Trade', 'Inclusive Growth & Poverty Metrics'],
    },
    description: 'IAS, IPS, IFS, and Central Civil Services Preliminary Examination.',
    markingRule: '+2 for correct, -0.66 (1/3rd of 2) for wrong',
  },
  {
    id: 'upsc_csat',
    name: 'UPSC CSAT Prelims (General Studies Paper 2)',
    category: 'UPSC & Defence',
    badge: 'Aptitude / Civil Services',
    defaultDuration: 120,
    defaultMarks: 2.5,
    defaultNegative: 0.83,
    defaultQuestions: 25,
    subjects: [
      'Reading Comprehension & Critical Reasoning',
      'Logical Reasoning & Analytical Ability',
      'Decision Making & Problem Solving',
      'General Mental Ability',
      'Basic Numeracy (Class X level)',
      'Data Interpretation (Charts & Tables)',
    ],
    popularTopics: {
      'Reading Comprehension & Critical Reasoning': ['Crux & Central Idea', 'Logical Assumption & Inference', 'Weakening/Strengthening Arguments', 'Implication & Conclusion'],
      'Basic Numeracy (Class X level)': ['Divisibility & Remainder Theorem', 'Permutations & Combinations', 'Probability', 'Percentages & Ratios', 'Sequences & Series'],
      'Logical Reasoning & Analytical Ability': ['Seating Arrangements', 'Puzzles & Syllogisms', 'Clocks & Calendars', 'Direction & Distance'],
    },
    description: 'Qualifying paper (33% required) for UPSC Civil Services Examination.',
    markingRule: '+2.5 for correct, -0.83 (1/3rd of 2.5) for wrong',
  },
  {
    id: 'upsc_cds',
    name: 'UPSC CDS (Combined Defence Services — IMA, OTA, INA, AFA)',
    category: 'UPSC & Defence',
    badge: 'Defence Officer',
    defaultDuration: 120,
    defaultMarks: 1,
    defaultNegative: 0.33,
    defaultQuestions: 30,
    subjects: [
      'English Language',
      'General Knowledge',
      'Elementary Mathematics',
    ],
    popularTopics: {
      'English Language': ['Spotting Errors', 'Ordering of Words & Sentences', 'Idioms & Phrases', 'Comprehension'],
      'General Knowledge': ['Indian History', 'Polity & Geography', 'Defence & Strategic Affairs', 'General Science'],
      'Elementary Mathematics': ['Arithmetic', 'Algebra & Trigonometry', 'Geometry & Mensuration', 'Statistics'],
    },
    description: 'Commissioned Officer recruitment in the Indian Army, Navy, and Air Force.',
    markingRule: '+1 for correct, -0.33 for wrong',
  },
  {
    id: 'upsc_nda',
    name: 'UPSC NDA & NA (National Defence Academy 10+2)',
    category: 'UPSC & Defence',
    badge: '10+2 Defence',
    defaultDuration: 150,
    defaultMarks: 2.5,
    defaultNegative: 0.83,
    defaultQuestions: 25,
    subjects: [
      'Mathematics (Class 11 & 12 level)',
      'General Ability Test: English',
      'General Ability Test: General Knowledge',
    ],
    popularTopics: {
      'Mathematics (Class 11 & 12 level)': ['Algebra', 'Matrices and Determinants', 'Trigonometry', 'Analytical Geometry (2D & 3D)', 'Differential Calculus', 'Vector Algebra', 'Statistics & Probability'],
      'General Ability Test: English': ['Grammar and Usage', 'Vocabulary', 'Comprehension'],
      'General Ability Test: General Knowledge': ['Physics & Chemistry', 'General Science', 'History & Freedom Movement', 'Geography', 'Current Events'],
    },
    description: 'Prestigious tri-service training academy entrance test for young military officers.',
    markingRule: 'Maths: +2.5 / -0.83; GAT: +4.0 / -1.33',
  },
  {
    id: 'afcat',
    name: 'AFCAT (Air Force Common Admission Test)',
    category: 'UPSC & Defence',
    badge: 'Air Force',
    defaultDuration: 120,
    defaultMarks: 3,
    defaultNegative: 1.0,
    defaultQuestions: 25,
    subjects: [
      'General Awareness',
      'Verbal Ability in English',
      'Numerical Ability',
      'Reasoning and Military Aptitude Test',
    ],
    popularTopics: {
      'General Awareness': ['History', 'Geography', 'Sports', 'National/International Defence', 'Basic Science', 'Environment'],
      'Verbal Ability in English': ['Comprehension', 'Detecting Errors', 'Synonyms/Antonyms', 'Idioms and Phrases', 'Analogy'],
      'Numerical Ability': ['Decimal Fraction', 'Time and Work', 'Average/Profit & Loss', 'Ratio & Proportion', 'Simple & Compound Interest'],
      'Reasoning and Military Aptitude Test': ['Verbal Skills', 'Spatial Ability', 'Non-Verbal Venn Reasoning', 'Embedded Figures'],
    },
    description: 'Indian Air Force officer recruitment for Flying, Ground Duty Technical & Non-Technical Branches.',
    markingRule: '+3 for correct, -1.0 for wrong',
  },

  // --- State PSC Category ---
  {
    id: 'state_psc',
    name: 'State PSCs (UPPSC, BPSC, MPPSC, RAS, MPSC, WBPSC)',
    category: 'State PSC',
    badge: 'State Civil Services',
    defaultDuration: 120,
    defaultMarks: 2,
    defaultNegative: 0.66,
    defaultQuestions: 25,
    subjects: [
      'General Studies (History, Polity, Economy, Geography)',
      'State Specific GK, History & Culture',
      'General Science & Agriculture',
      'Current Affairs & Schemes',
      'General Mental Ability & CSAT',
    ],
    popularTopics: {
      'General Studies (History, Polity, Economy, Geography)': ['Indian National Movement', 'Indian Constitution & Federalism', 'Census & Human Geography', 'Agriculture & Rural Development'],
      'State Specific GK, History & Culture': ['State History & Dynasties', 'State Geography & Rivers', 'Tribal Culture & Folk Art', 'State Budgets & Welfare Schemes'],
      'General Science & Agriculture': ['Applied Biology & Diseases', 'Soil Science & Cropping Patterns', 'Space & Defense Tech in India'],
    },
    description: 'State Administrative Services (SDM, DSP, Commercial Tax Officer, Tehsildar).',
    markingRule: '+2 for correct, -0.66 (varies by state)',
  },

  // --- Teaching & Eligibility Category ---
  {
    id: 'ctet_tet',
    name: 'CTET / State TET (Central Teacher Eligibility Test Paper 1 & 2)',
    category: 'Teaching',
    badge: 'Teaching',
    defaultDuration: 150,
    defaultMarks: 1,
    defaultNegative: 0,
    defaultQuestions: 30,
    subjects: [
      'Child Development & Pedagogy',
      'Language I (English / Hindi)',
      'Language II (English / Hindi / Regional)',
      'Mathematics & Pedagogy',
      'Environmental Studies (EVS)',
      'Social Studies / Science (Paper 2)',
    ],
    popularTopics: {
      'Child Development & Pedagogy': [
        'Piaget, Vygotsky, Kohlberg Theories',
        'Inclusive Education & Addressing Diverse Learners',
        'Learning & Motivation Theories',
        'Constructivism & CCE (Evaluation)',
      ],
      'Mathematics & Pedagogy': ['Numbers & Operations', 'Shapes & Geometry', 'Pedagogy of Mathematics', 'Diagnostic & Remedial Teaching'],
      'Environmental Studies (EVS)': ['Family & Friends', 'Food, Shelter & Water', 'Travel & Things We Make', 'EVS Pedagogy & Activities'],
    },
    description: 'National qualification exam for primary (classes 1-5) and upper primary (classes 6-8) teachers.',
    markingRule: '+1 for correct, NO negative marking (0)',
  },

  // --- Custom / User-Defined Category ---
  {
    id: 'custom_exam',
    name: 'Custom / Other Competitive Examination',
    category: 'Custom',
    badge: 'Custom',
    defaultDuration: 60,
    defaultMarks: 2,
    defaultNegative: 0.5,
    defaultQuestions: 20,
    subjects: [
      'General Subject 1',
      'General Subject 2',
      'Logical Aptitude',
    ],
    popularTopics: {
      'General Subject 1': ['Core Fundamentals', 'Advanced Concepts', 'Applied Questions'],
      'General Subject 2': ['Theory', 'Problem Solving'],
    },
    description: 'Create tailored question sets for any private certification, entrance, or institute exam.',
    markingRule: 'Customizable marks & penalties',
  },
];

// ============================================================
// Interactive Prompt Generator Function
// ============================================================

export interface PromptBuilderConfig {
  examName: string;
  category: string;
  mode: 'fresh' | 'convert' | 'batch';
  subjects: string[];
  topic: string;
  subtopic?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarking: number;
  paperTitle?: string;
  description?: string;
  includeHints: boolean;
  includeSolutions: boolean;
  includeShortcuts: boolean;
  includeFormulas: boolean;
  includeSuggestions: boolean;
  includeTimeEstimate: boolean;
  includePassages: boolean;
  rawTextToConvert?: string;
  batchPaperCount?: number;
}

export function buildCustomAIPrompt(config: PromptBuilderConfig): string {
  const {
    examName,
    mode,
    subjects,
    topic,
    subtopic,
    difficulty,
    questionCount,
    durationMinutes,
    marksPerQuestion,
    negativeMarking,
    paperTitle,
    description,
    includeHints,
    includeSolutions,
    includeShortcuts,
    includeFormulas,
    includeSuggestions,
    includeTimeEstimate,
    includePassages,
    rawTextToConvert,
    batchPaperCount = 3,
  } = config;

  const subjectListStr = subjects.length > 0 ? subjects.join(', ') : 'All Prescribed Sections';
  const computedTotalMarks = questionCount * marksPerQuestion;
  const title = paperTitle?.trim() || `${examName} — ${topic || subjects[0] || 'Comprehensive'} Mock Test`;

  // Sample Question Spec for Schema
  const sampleQuestionObj: Record<string, unknown> = {
    id: 1,
    subject: subjects[0] || "Subject Name",
    topic: topic || "Topic Name",
    ...(subtopic && { subtopic: subtopic }),
    difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
    question: "Full text of the question here. Use clear markdown formatting where beneficial.",
    options: [
      "Option A text",
      "Option B text",
      "Option C text",
      "Option D text"
    ],
    correctAnswer: "Option B text",
    answerIndex: 1,
    marks: marksPerQuestion,
    negativeMarks: negativeMarking,
    ...(includeHints && { hint: "A clever clue or elimination guidance for the student." }),
    ...(includeSolutions && { solution: "Detailed, step-by-step conceptual or mathematical proof." }),
    ...(includeShortcuts && { shortcut: "Fast 10-second exam trick, formula shortcut, or option elimination rule." }),
    ...(includeFormulas && { formula: "Relevant math/physics formula: e.g. a^2 + b^2 = c^2" }),
    ...(includeSuggestions && { learningSuggestion: "Specific concept or chapter to review if answered incorrectly." }),
    ...(includeTimeEstimate && { timeEstimate: 45 }),
    ...(includePassages && { passage: "Reading comprehension passage context if this question is part of a passage set." }),
    tags: [examName.toLowerCase().replace(/[^\w]/g, '-').slice(0, 15), "mock-test"]
  };

  // --- MODE 1: CONVERT RAW TEXT / PDF / PYQ TO JSON ---
  if (mode === 'convert') {
    return [
      `You are an expert ${examName} Examination Data Engineer & Question Parser.`,
      `Your task is to parse, format, and structure the questions provided below into a strictly conformant JSON file for our Exam Testing Platform.`,
      '',
      '=== TARGET EXAM & PARAMETERS ===',
      `• Target Examination: ${examName}`,
      `• Paper Title: "${title}"`,
      `• Target Subjects: ${subjectListStr}`,
      `• Duration: ${durationMinutes} Minutes`,
      `• Marks per Question: ${marksPerQuestion}`,
      `• Negative Marking: ${negativeMarking}`,
      '',
      '=== RAW QUESTIONS SOURCE (CONVERT THE FOLLOWING) ===',
      rawTextToConvert?.trim() || '/* [PASTE YOUR RAW QUESTIONS, PDF TEXT, OR NOTES HERE] */',
      '',
      '=== STRICT JSON OUTPUT SCHEMA ===',
      'Wrap all converted questions into this exact paper object:',
      '```json',
      JSON.stringify({
        exam: examName,
        paperTitle: title,
        description: description || `Extracted practice test for ${examName} covering ${subjectListStr}`,
        durationMinutes: durationMinutes,
        totalMarks: computedTotalMarks,
        negativeMarking: negativeMarking,
        difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
        subjects: subjects.length > 0 ? subjects : ["General Studies"],
        questions: [sampleQuestionObj]
      }, null, 2),
      '```',
      '',
      '=== MANDATORY VALIDATION RULES ===',
      '1. Return ONLY the JSON object. Do not include introductory text, markdown greetings, or trailing notes.',
      '2. "questions" MUST be an array of question objects, numbered with sequential "id" integers (1, 2, 3...).',
      '3. Each question MUST have exactly 4 strings in the "options" array.',
      '4. "correctAnswer" MUST be the exact verbatim string of one of the options.',
      '5. "answerIndex" MUST be the 0-based integer index (0, 1, 2, or 3) corresponding to the "correctAnswer".',
      '6. Verify all mathematical, factual, and reasoning answers before finalizing.',
      includeSolutions ? '7. Provide clear, high-quality step-by-step explanations in the "solution" field.' : '',
      includeShortcuts ? '8. Provide fast mental math or elimination tips in the "shortcut" field where applicable.' : '',
    ].filter(Boolean).join('\n');
  }

  // --- MODE 2: BATCH MULTI-PAPER GENERATOR ---
  if (mode === 'batch') {
    return [
      `You are a senior question setter and syllabus expert for ${examName}.`,
      `Generate a BATCH of ${batchPaperCount} separate, complete Mock Test Question Papers as a single valid JSON array.`,
      '',
      '=== BATCH TEST SPECIFICATIONS ===',
      `• Examination: ${examName}`,
      `• Number of Paper Sets to Generate: ${batchPaperCount}`,
      `• Questions per Paper Set: ${questionCount}`,
      `• Sections / Subjects: ${subjectListStr}`,
      topic ? `• Primary Topic / Area: "${topic}"` : '',
      subtopic ? `• Subtopic: "${subtopic}"` : '',
      `• Difficulty Level: ${difficulty.toUpperCase()}`,
      `• Duration per Paper: ${durationMinutes} Minutes`,
      `• Marks per Question: ${marksPerQuestion} | Negative Penalty: ${negativeMarking}`,
      '',
      '=== STRICT BATCH JSON OUTPUT FORMAT ===',
      'Return a JSON array containing multiple paper objects: [ { paper 1 }, { paper 2 }, ... ]',
      '```json',
      JSON.stringify([
        {
          exam: examName,
          paperTitle: `${title} — Set 1`,
          description: `Full Mock Paper 1 for ${examName}`,
          durationMinutes: durationMinutes,
          totalMarks: computedTotalMarks,
          negativeMarking: negativeMarking,
          difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
          subjects: subjects,
          questions: [sampleQuestionObj]
        },
        {
          exam: examName,
          paperTitle: `${title} — Set 2`,
          description: `Full Mock Paper 2 for ${examName}`,
          durationMinutes: durationMinutes,
          totalMarks: computedTotalMarks,
          negativeMarking: negativeMarking,
          difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
          subjects: subjects,
          questions: [sampleQuestionObj]
        }
      ], null, 2),
      '```',
      '',
      '=== CRITICAL QUALITY RULES ===',
      `1. Generate exactly ${batchPaperCount} distinct papers. Do not duplicate questions across sets.`,
      '2. Return ONLY the raw JSON array — no markdown backticks outside JSON, no prose.',
      '3. Every question must have 4 options, a matching correctAnswer, and 0-based answerIndex.',
      '4. Adhere strictly to the authentic testing standards and syllabus of the chosen exam.',
    ].filter(Boolean).join('\n');
  }

  // --- MODE 3: FRESH SINGLE QUESTION PAPER GENERATOR ---
  return [
    `You are an elite faculty member and question designer for ${examName}.`,
    `Generate an original, high-yield ${questionCount}-question mock test paper formatted to current exam standards.`,
    '',
    '=== EXAM & SECTION SPECIFICATIONS ===',
    `• Target Exam: ${examName}`,
    `• Paper Title: "${title}"`,
    `• Target Subject(s): ${subjectListStr}`,
    topic ? `• Target Topic: "${topic}"` : '• Topic: Comprehensive representation across subject syllabus',
    subtopic ? `• Subtopic Focus: "${subtopic}"` : '',
    `• Difficulty Level: ${difficulty.toUpperCase()}`,
    `• Total Questions: ${questionCount}`,
    `• Time Allowed: ${durationMinutes} Minutes`,
    `• Marks per Question: ${marksPerQuestion} (+${marksPerQuestion})`,
    `• Negative Penalty: ${negativeMarking} (-${negativeMarking})`,
    `• Total Maximum Marks: ${computedTotalMarks}`,
    '',
    '=== STRICT JSON OUTPUT SCHEMA ===',
    'Output the complete test paper as a single valid JSON object following this exact structure:',
    '```json',
    JSON.stringify({
      exam: examName,
      paperTitle: title,
      description: description || `High-yield practice test for ${examName} focusing on ${topic || subjectListStr}`,
      durationMinutes: durationMinutes,
      totalMarks: computedTotalMarks,
      negativeMarking: negativeMarking,
      difficulty: difficulty === 'mixed' ? 'medium' : difficulty,
      subjects: subjects,
      questions: [sampleQuestionObj]
    }, null, 2),
    '```',
    '',
    '=== MANDATORY INSTRUCTIONS ===',
    '1. Return ONLY the valid JSON object. No intro, no conversational text, no markdown wrappers.',
    '2. "questions" array must contain exactly the requested number of high-quality questions.',
    '3. Each question must feature 4 realistic, distinct options (A, B, C, D) without duplicates.',
    '4. "correctAnswer" MUST exactly match the string of one of the options.',
    '5. "answerIndex" must be the 0-based index (0, 1, 2, or 3) of that option.',
    includeSolutions ? '6. Provide comprehensive step-by-step mathematical/conceptual derivations in "solution".' : '',
    includeShortcuts ? '7. Include speed tricks or elimination shortcuts in "shortcut" where applicable.' : '',
    includeHints ? '8. Include a helpful reasoning hint in "hint".' : '',
    includeFormulas ? '9. Include the governing formula in "formula".' : '',
    includeSuggestions ? '10. Suggest the core concept to revise in "learningSuggestion".' : '',
    '11. Maintain 100% mathematical, scientific, and historical accuracy.',
  ].filter(Boolean).join('\n');
}

// ============================================================
// Generate Sample Paper JSON based on Exam Preset
// ============================================================

export function generateSamplePaperJSON(preset: ExamPreset, subject?: string): string {
  const chosenSubject = subject && preset.subjects.includes(subject) ? subject : preset.subjects[0];
  const topics = preset.popularTopics[chosenSubject] || ['Fundamentals', 'Standard Applications'];
  const topic1 = topics[0] || 'Core Concepts';
  const topic2 = topics[1] || 'Problem Solving';

  const sample = {
    exam: preset.name.split(' (')[0] || preset.name,
    paperTitle: `${preset.name.split(' (')[0]} — Sample Practice Test`,
    description: `Official schema template and practice questions for ${preset.name}.`,
    durationMinutes: preset.defaultDuration,
    totalMarks: preset.defaultMarks * 2,
    negativeMarking: preset.defaultNegative,
    difficulty: 'medium',
    subjects: preset.subjects.slice(0, 3),
    questions: [
      {
        id: 1,
        subject: chosenSubject,
        topic: topic1,
        subtopic: 'Introductory Analysis',
        difficulty: 'medium',
        question: `Sample Question 1 for ${preset.name}: What is the primary characteristic of ${topic1}?`,
        options: [
          'First plausible option representing standard behavior',
          'Second verified correct option with detailed precision',
          'Third common distractor misconception',
          'Fourth alternative possibility'
        ],
        correctAnswer: 'Second verified correct option with detailed precision',
        answerIndex: 1,
        marks: preset.defaultMarks,
        negativeMarks: preset.defaultNegative,
        hint: `Focus on the foundational properties of ${topic1}.`,
        solution: `Step-by-step resolution: In ${chosenSubject}, ${topic1} is characterized by the verified second option because of the underlying examination standard rule.`,
        shortcut: 'Eliminate options A and C directly by checking the boundary conditions.',
        learningSuggestion: `Revise chapter notes on ${topic1} in your study library.`,
        timeEstimate: 45,
        tags: [preset.id, 'sample-template']
      },
      {
        id: 2,
        subject: chosenSubject,
        topic: topic2,
        subtopic: 'Applied Practice',
        difficulty: 'hard',
        question: `Sample Question 2 for ${preset.name}: If the parameters for ${topic2} are evaluated under standard conditions, which result holds true?`,
        options: [
          'Value increases linearly by factor of 2',
          'Value remains completely invariant',
          'Value decreases exponentially with respect to time',
          'Value oscillates symmetrically'
        ],
        correctAnswer: 'Value increases linearly by factor of 2',
        answerIndex: 0,
        marks: preset.defaultMarks,
        negativeMarks: preset.defaultNegative,
        hint: 'Recall the proportionality theorem applicable here.',
        solution: 'Detailed calculation: Applying the standard formula yields a 2x proportional increase.',
        shortcut: 'Use dimensional analysis to confirm the linear scaling factor.',
        timeEstimate: 60,
        tags: [preset.id, 'sample-template']
      }
    ]
  };

  return JSON.stringify(sample, null, 2);
}

// ============================================================
// Interactive Visual Schema Fields Documentation
// ============================================================

export interface SchemaFieldDoc {
  name: string;
  type: string;
  required: boolean;
  level: 'paper' | 'question';
  description: string;
  example: string;
}

export const SCHEMA_DOCS: SchemaFieldDoc[] = [
  // Paper Level
  {
    name: 'paperTitle',
    type: 'string',
    required: true,
    level: 'paper',
    description: 'The title or name of the question paper displayed on cards, headers, and reports.',
    example: '"SSC CGL 2024 Tier 1 — All India Mock 04"',
  },
  {
    name: 'durationMinutes',
    type: 'number',
    required: true,
    level: 'paper',
    description: 'Total test duration in minutes. Drives the countdown timer in exam mode.',
    example: '60',
  },
  {
    name: 'questions',
    type: 'QuestionJSON[]',
    required: true,
    level: 'paper',
    description: 'Array of question objects. Must contain at least 1 valid question.',
    example: '[ { "id": 1, ... } ]',
  },
  {
    name: 'exam',
    type: 'string',
    required: false,
    level: 'paper',
    description: 'Target competitive examination (e.g. "SSC CGL", "RRB NTPC", "IBPS PO", "UPSC").',
    example: '"SSC CGL"',
  },
  {
    name: 'totalMarks',
    type: 'number',
    required: false,
    level: 'paper',
    description: 'Total maximum marks for the paper. Auto-calculated from questions if omitted.',
    example: '200',
  },
  {
    name: 'negativeMarking',
    type: 'number',
    required: false,
    level: 'paper',
    description: 'Default penalty subtracted for incorrect answers (e.g. 0.5, 0.25, 0.66, 1.0).',
    example: '0.5',
  },
  {
    name: 'difficulty',
    type: '"easy" | "medium" | "hard"',
    required: false,
    level: 'paper',
    description: 'Overall difficulty rating of the paper set.',
    example: '"medium"',
  },
  {
    name: 'subjects',
    type: 'string[]',
    required: false,
    level: 'paper',
    description: 'List of subjects or sections covered in this question paper.',
    example: '["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"]',
  },
  {
    name: 'description',
    type: 'string',
    required: false,
    level: 'paper',
    description: 'Brief overview or syllabus description of the question paper.',
    example: '"Full length mock test strictly matching the latest TCS exam pattern."',
  },

  // Question Level
  {
    name: 'id',
    type: 'number | string',
    required: true,
    level: 'question',
    description: 'Unique identifier for the question within this paper set (e.g. 1, 2, 3...).',
    example: '1',
  },
  {
    name: 'question',
    type: 'string',
    required: true,
    level: 'question',
    description: 'The complete question problem statement. Supports markdown, latex ($x^2$), and tables.',
    example: '"If x + 1/x = 5, what is the value of x^2 + 1/x^2?"',
  },
  {
    name: 'options',
    type: 'string[]',
    required: true,
    level: 'question',
    description: 'Array of at least 2 (typically 4) answer choices.',
    example: '["21", "23", "25", "27"]',
  },
  {
    name: 'correctAnswer',
    type: 'string',
    required: true,
    level: 'question',
    description: 'Verbatim text matching exactly one of the strings inside options.',
    example: '"23"',
  },
  {
    name: 'answerIndex',
    type: 'number',
    required: true,
    level: 'question',
    description: 'The 0-based integer index of the correct option (0 = Option A, 1 = Option B, etc.).',
    example: '1',
  },
  {
    name: 'marks',
    type: 'number',
    required: true,
    level: 'question',
    description: 'Positive mark score awarded for answering correctly.',
    example: '2',
  },
  {
    name: 'subject',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Subject section name (e.g. "Quantitative Aptitude", "Reasoning", "General Awareness").',
    example: '"Quantitative Aptitude"',
  },
  {
    name: 'topic',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Syllabus topic for analytics and drills (e.g. "Algebra", "Syllogism", "Polity").',
    example: '"Algebra"',
  },
  {
    name: 'subtopic',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Specific sub-concept classification.',
    example: '"Algebraic Identities"',
  },
  {
    name: 'negativeMarks',
    type: 'number',
    required: false,
    level: 'question',
    description: 'Specific negative mark penalty for this question. Falls back to paper negative marking.',
    example: '0.5',
  },
  {
    name: 'difficulty',
    type: '"easy" | "medium" | "hard"',
    required: false,
    level: 'question',
    description: 'Question-level difficulty grade.',
    example: '"medium"',
  },
  {
    name: 'hint',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Helpful hint accessible to students during practice mode without revealing the answer.',
    example: '"Square both sides of the identity (x + 1/x)^2 = x^2 + 2 + 1/x^2."',
  },
  {
    name: 'solution',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Detailed, step-by-step mathematical or conceptual explanation for post-test review.',
    example: '"(x + 1/x)^2 = 5^2 => x^2 + 1/x^2 + 2 = 25 => x^2 + 1/x^2 = 25 - 2 = 23."',
  },
  {
    name: 'shortcut',
    type: 'string',
    required: false,
    level: 'question',
    description: 'High-speed trick, Vedic math method, or option elimination rule.',
    example: '"Formula shortcut: If x + 1/x = k, then x^2 + 1/x^2 = k^2 - 2 = 25 - 2 = 23."',
  },
  {
    name: 'formula',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Governing equation or formula displayed in the formula pill.',
    example: '"(x + 1/x)^2 = x^2 + 1/x^2 + 2"',
  },
  {
    name: 'passage',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Shared reading comprehension passage or case study text.',
    example: '"Read the following editorial excerpt carefully before answering questions 1 to 5..."',
  },
  {
    name: 'learningSuggestion',
    type: 'string',
    required: false,
    level: 'question',
    description: 'Actionable revision advice for students who get this question wrong.',
    example: '"Revise Algebraic Identities and practice 10 similar problems in Drill Hub."',
  },
  {
    name: 'timeEstimate',
    type: 'number',
    required: false,
    level: 'question',
    description: 'Ideal target completion time in seconds.',
    example: '30',
  },
  {
    name: 'tags',
    type: 'string[]',
    required: false,
    level: 'question',
    description: 'Search tags or previous year paper identifiers.',
    example: '["ssc-cgl-2023", "tier-1", "algebra"]',
  },
];
