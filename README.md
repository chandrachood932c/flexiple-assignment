# Flexiple AI Recruiter — Sourcing & Refinement Loop

An intelligent recruitment assistant that transforms natural language hiring queries into structured objective filters, subjective evaluation rubrics, and ranked candidate matches with explainable citations and an interactive refinement loop.

---

## 🚀 Quick Setup

### 1. Install & Run
```bash
cd ai-recruiter
npm install
npm run dev
```

### 2. Configure API Key & Model in UI
Open **[http://localhost:3000](http://localhost:3000)** in your browser:
- On initial launch, an **API Settings** modal opens automatically (you can also reopen it anytime via the **API Settings** button in the top navigation).
- Enter your **Groq API Key** ([Get a free key at console.groq.com](https://console.groq.com/keys)).
- Enter your model (e.g. `llama-3.3-70b-versatile` or `openai/gpt-oss-20b`).
- Click **Save Settings**. The credentials are stored securely in session state.

---

## 🧠 System Architecture & Workflow

```
[ Recruiter Query / Feedback ]
              │
              ▼
┌─────────────────────────────────────────┐
│ 1. AI Parameter & Rubric Extraction     │ ──► Extracts hard filters (min/max exp, role, skills)
│    (Groq LLM via /api/refine-loop)      │     and builds subjective criteria with weights
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 2. Deterministic Filtering Engine       │ ──► Validates hard boundaries in code:
│    (Local Rule Safeguards)              │     • Min & max experience bounds
│                                         │     • Role domain & locations
│                                         │     • Progressive relaxation if 0 matches
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 3. Rubric Scoring & Evidence Citations  │ ──► Scores candidates (0–100%) against all profile keys
│    (Evidence-Based Evaluation)          │     (title, skills, companies, education, exp)
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ 4. Interactive Refinement Loop          │ ──► One-click feedback or conversational steering
│    (Candidate State & Activity Log)     │     updates rubrics, preserves shortlists, and logs history
└─────────────────────────────────────────┘
```

---

## 🖥️ Screen Layout & Interactive Features (`app/page.js`)

Designed specifically for recruiter velocity and cognitive clarity:

### 1. Header Navigation
- **Branding & Status**: Shows active recruitment session status.
- **API Settings**: Quick modal to inspect or update the Groq API key and model.
- **New Search (`handleReset`)**: Clears queries, filters, rubrics, shortlist, and resets the activity log.
- **Freeze / Unfreeze Search**:
  - `Freeze search`: Locks candidate cards to prevent accidental changes while sharing or reviewing.
  - `Unfreeze search`: Unlocks cards to continue conversational refinements.

### 2. Left Column (Control Sidebar)
- **Find Candidates / Refine Search**:
  - **Initial State**: Natural language prompt input (e.g., *"Senior React developers with 4–7 years of experience, startup background, based in Bangalore"*).
  - **Refinement State**: Once a search has run, switches to an interactive feedback bar (e.g., *"Candidate #2 is a great fit, prioritize similar startup background"*).
- **Search Criteria Panel**:
  - **Changelog Banner**: Displays real-time summary of the latest AI modifications.
  - **Interactive Filter Pills**: Badges for Role, Experience range, Skills, Locations, and Company Types.
  - **Click-to-Remove (`×`)**: Click any pill to remove a skill, location, or company type on the fly without re-typing.
- **Fit Signals (Rubric)**:
  - Displays each subjective quality standard with priority level (`HIGH`, `MEDIUM`, `LOW`).
- **Activity Log**:
  - Chronological timeline tracking every action (`Search`, `Refined`, `Filter`), timestamp, prompt text, and corresponding changelog.

### 3. Right Column (Candidate Results)
- **Ranked Match Cards**:
  - **Fit Score Badge**: Color-coded percentage match (0–100%) and fit status (`strong_match`).
  - **Candidate Header**: Full name, current title, company name, location, and years of experience.
  - **Why this candidate matches**: Factual citations referencing candidate tools, company pedigree, and experience.
  - **Interactive Feedback Buttons**:
    - `Strong match` (thumbs-up): Shortlists the candidate and automatically tells the AI to prioritize similar profiles.
    - `Not a fit` (thumbs-down): Rejects the candidate and steers the search away from those gaps.

---

## 📋 Evaluated Candidate Profile Parameters

Candidates in `profiles.json` are evaluated across these explicit keys:

| Parameter | Type | How It Is Evaluated & Compared |
|---|---|---|
| `id` | String | Unique profile ID (e.g., `"p29"`). |
| `name` | String | Full candidate name. |
| `current_title` | String | Role title; matched against target engineering domains (`Frontend`, `Backend`, `DevOps`, etc.). |
| `years_experience` | Number | Total career experience; strictly validated by code regex against `min_exp` and `max_exp`. |
| `location` | String | Primary city or remote status (e.g., `"Bangalore"`, `"Amsterdam"`). |
| `current_company` | String | Employer where candidate currently works (e.g., `"Postman"`). |
| `current_company_type` | String | Organization category: `startup`, `scaleup`, `enterprise`, or `service`. |
| `skills` | Array | Core proficiencies and tools (e.g., `["PostgreSQL", "AWS RDS", "Terraform"]`). |
| `past_companies` | Array | Prior career history, titles, company types, and tenures (e.g. at `Razorpay`). |
| `education` | String | Academic background and institution tier (e.g., `"B.E. Computer Science, BITS Pilani"`). |
| `summary` | String | High-level engineering focus and domain highlights. |

---

## ⚙️ Search & Filter Parameters

### 1. Objective Filters (Hard Code Rules)
- **`role_focus`**: Primary technical focus (`Frontend`, `Backend`, `Full Stack`, `DevOps`, `Data`).
- **`min_exp` & `max_exp`**: Hard numerical bounds on years of experience.
- **`skills`**: Mandatory or preferred technologies.
- **`locations`**: Target cities or remote options.
- **`company_types`**: Preferred company stages (e.g., `["startup", "scaleup"]`).

### 2. Subjective Rubric (Fit & Ranking)
- **`title`**: Evaluation dimension (e.g., *"Scaleup Reliability Pedigree"*).
- **`weight`**: Priority weight (`high`, `medium`, `low`).
- **`guideline`**: Explicit benchmark evaluating exact candidate skills, company background, and depth.
- **`changelog`**: Human-readable summary of every change made during refinements.

---

## 💡 Example Prompts to Test

- **Initial Search (DevOps / Cloud):**
  > *"DevOps engineer with minimum 4 years experience who has worked with Kubernetes and AWS, based in Bangalore."*
- **Refinement (Candidate-Based Steering):**
  > *"Candidate #1 is a great fit, prioritize candidates with similar scaleup infrastructure background."*
- **Experience Bound Updates:**
  > *"Actually, we only want candidates with less than 6 years of experience."*
