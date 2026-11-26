# Study Hub — Notes, Tests & Mock Exams

A flexible study workspace for school subjects, university courses, certifications, and competitive exams. Create study notes and books, import or build question papers, take mock exams, review results, and practice mistakes. Exam and course names are user-defined; built-in exam templates are optional starting points.

## 🚀 Quick Start

### Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:5173` to see the app.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## 🌐 Deploy to GitHub Pages

Complete deployment guide available in [DEPLOYMENT.md](./DEPLOYMENT.md).

**Quick Steps:**
1. Create a GitHub repository
2. Add GitHub Secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Push to `main` branch
4. GitHub Actions will automatically deploy

Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

## 🔧 Supabase Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon/public key** from Settings → API

### 2. Run the SQL Schema

1. Go to SQL Editor in your Supabase dashboard
2. Copy and paste the contents of `supabase/schema.sql`
3. Run the query

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://astdxzjqapgfdfvzhfdx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzdGR4empxYXBnZmRmdnpoZmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNjc1NzgsImV4cCI6MjEwNjc0MzU3OH0.Y2UReMs4-vbEsnIv5Mkb3kk-HrtvZT8KvU7Y-66OCXc
```

**Note:** The `.env` file is already configured with your Supabase credentials. The app will automatically connect to your Supabase backend.

### 4. Enable Authentication

In Supabase Dashboard → Authentication → Providers:
- Enable **Email** provider
- Optionally configure other providers (Google, GitHub, etc.)

### 5. Run Database Migrations

Execute the SQL schema in your Supabase SQL Editor:
- File: `supabase/schema.sql`
- This creates all necessary tables, indexes, and RLS policies

For an existing deployment, run `supabase/migrations/add_book_chapters.sql`, `supabase/migrations/add_whiteboard_notes.sql`, `supabase/migrations/add_study_path_metadata.sql`, and `supabase/migrations/add_study_planner.sql` to enable books, chapters, HTML lessons, editable whiteboards, study-path metadata, and synced study plans. Subject spaces can be labeled for school, college, competitive exams, or self-study. Markdown, text, PDF, and DOCX uploads can be organized as notes or chapters; PDF and DOCX files are converted to editable text in the browser, and scanned PDFs require OCR before import. Whiteboards save strokes, shapes, and text as JSON in the notes table; PNG is only an optional export.

## 📦 GitHub Pages Deployment

### 1. Configure Vite Base Path

For GitHub Pages project URLs (e.g., `https://username.github.io/repo-name/`), update `vite.config.js`:

```js
export default defineConfig({
  base: '/repo-name/',  // Add this line
  plugins: [react(), tailwindcss()],
  // ...
});
```

### 2. Add GitHub Secrets

In your repository → Settings → Secrets and variables → Actions, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Push to Main

The GitHub Actions workflow will automatically build and deploy to GitHub Pages.

## 🎯 Core Workflow

```
AI Model → Generate JSON → Copy JSON → Paste in App → Validate → Import → Exam Library → Start Exam → Answer → Submit → Results → Learn → Practice → Improve
```

## 📋 JSON Schema

```json
{
  "exam": "Grade 10 Biology",
  "paperTitle": "Practice Set 01",
  "description": "Mixed difficulty practice paper",
  "durationMinutes": 60,
  "totalMarks": 100,
  "negativeMarking": 0.5,
  "difficulty": "medium",
  "subjects": ["Biology", "Chemistry"],
  "questions": [
    {
      "id": 1,
      "subject": "Quantitative Aptitude",
      "topic": "Percentage",
      "difficulty": "medium",
      "question": "What is 20% of 450?",
      "options": ["80", "90", "100", "110"],
      "correctAnswer": "90",
      "answerIndex": 1,
      "marks": 2,
      "negativeMarks": 0.5,
      "hint": "Convert percentage to fraction",
      "solution": "20% of 450 = 20/100 × 450 = 90",
      "shortcut": "10% of 450 = 45, so 20% = 90",
      "learningSuggestion": "Practice percentage conversions"
    }
  ]
}
```

### Required Fields
- `paperTitle`, `durationMinutes`, `totalMarks`, `questions` array
- Each question: `id`, `question`, `options` (array), `correctAnswer`, `answerIndex`, `marks`

### Optional Fields
- `description`, `negativeMarking`, `difficulty`, `subjects`
- Per question: `subject`, `topic`, `subtopic`, `difficulty`, `hint`, `solution`, `method`, `shortcut`, `learningSuggestion`, `timeEstimate`, `tags`, `source`, `image`, `formula`, `table`, `passage`

## 🏗️ Architecture

```
src/
├── components/
│   ├── AuthGate.tsx          # Authentication UI
│   ├── Dashboard.tsx         # Main dashboard with tabs
│   ├── ExamInterface.tsx     # Full exam-taking UI
│   ├── JsonImporter.tsx      # JSON import + AI prompt generator
│   └── ResultsPage.tsx       # Results + learning mode
├── hooks/
│   └── useAuth.ts            # Authentication hook
├── lib/
│   └── supabase.ts           # Supabase client
├── services/
│   └── database.ts           # Database operations + localStorage fallback
├── types/
│   └── index.ts              # TypeScript types
├── utils/
│   ├── demoData.ts           # Demo paper data
│   ├── grader.ts             # Scoring & analytics
│   └── validator.ts          # JSON validation
├── App.tsx                   # Main app component
├── main.tsx                  # Entry point
└── index.css                 # Global styles
```

## ✨ Features

### Paper Management
- ✅ Paste or upload JSON question papers
- ✅ Detailed validation with specific error messages
- ✅ Preview before importing
- ✅ Duplicate detection
- ✅ Export papers back to JSON
- ✅ AI Prompt Generator for creating questions

### Exam Interface
- ✅ Professional examination portal UI
- ✅ Countdown timer with warnings
- ✅ Question palette with status indicators
- ✅ Subject-grouped navigation
- ✅ Mark for review
- ✅ Auto-save progress
- ✅ Resume after refresh
- ✅ Keyboard shortcuts
- ✅ Browser navigation protection
- ✅ Auto-submit on timer expiry

### Results & Learning
- ✅ Score summary with KPIs
- ✅ Performance by subject
- ✅ Performance by topic
- ✅ Question-by-question analysis
- ✅ Hints, solutions, shortcuts
- ✅ Learning suggestions
- ✅ Practice weak areas

### Practice Modes
- ✅ Quick Practice
- ✅ Topic Practice
- ✅ Weak Area Practice
- ✅ Previous Mistakes
- ✅ Timed Practice
- ✅ Random Practice

### Mistake Notebook
- ✅ Auto-tracked incorrect answers
- ✅ Incorrect count tracking
- ✅ Solutions and shortcuts
- ✅ Learning suggestions
- ✅ Mark as resolved

### Bookmarks
- ✅ Save important questions
- ✅ Categories (important, difficult, shortcut, etc.)
- ✅ Filter by category

### Analytics Dashboard
- ✅ Total exams, questions, accuracy
- ✅ Score progress chart
- ✅ Recent attempts table
- ✅ Subject and topic analysis

### Authentication
- ✅ Supabase Auth (Email)
- ✅ Guest mode (localStorage)
- ✅ Row Level Security
- ✅ Persistent sessions

### Responsive Design
- ✅ Desktop: 3-column exam layout
- ✅ Tablet: 2-column optimized
- ✅ Mobile: Single column with drawer navigation

## 🔒 Data Security

- All user data protected by Supabase RLS policies
- Users can only access their own data
- No service-role keys in frontend
- Anon key only (public, safe for client-side)

## 🌐 Deployment

### GitHub Pages
The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys on push to `main`.

### Environment Variables for CI/CD
Add these as repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 📝 License

MIT
