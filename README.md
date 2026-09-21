# Flexiple AI Recruiter — Sourcing & Refinement Loop

An intelligent recruitment assistant that transforms natural language hiring queries into structured objective filters, subjective evaluation rubrics, and ranked candidate matches with explainable citations and an interactive refinement loop.

---

##  Quick Setup

### 1. Clone & Install Dependencies
```bash
cd ai-recruiter
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```

Populate the required environment variables:
```env
GROQ_API_KEY='your_groq_api_key_here'
GROQ_MODEL='llama-3.3-70b-versatile'
```

| Environment Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | **Yes** | Your Groq Cloud API key ([Get one free at console.groq.com](https://console.groq.com/keys)) |
| `GROQ_MODEL` | Optional | Groq LLM model ID (defaults to `llama-3.3-70b-versatile`) |

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧠 System Architecture & Workflow

```
[ Natural Language Query ]
            │
            ▼
┌──────────────────────────────────────┐
│  1. LLM Filter & Rubric Extraction   │ ──► Extracts objective criteria + weighted rubric
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  2. Deterministic Filtering Engine   │ ──► Hard filtering on skills, exp, location, domain
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  3. Rubric Scoring & Match Citation  │ ──► Scores candidates (0-100%) with concrete evidence
└──────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────┐
│  4. Interactive Refinement Loop      │ ──► 1-Click Match/Reject or feedback prompt updates
└──────────────────────────────────────┘     rubric & maintains chronological activity history
```

---

##  Screen Layout & User Experience

Designed specifically for recruiter velocity and cognitive clarity:

- **Left Column (Sidebar)**:
  - **Find Candidates / Refine Search**: Initial search box or feedback input to steer the search (e.g., *"prioritize candidate #2"*).
  - **Search Criteria & Rubric**: Displays active filters (role focus, min experience, skills, locations, company types with click `×` to remove), latest changelog, and weighted fit signals.
  - **Activity Log**: Chronological timeline showing every action, prompt, time, and changelog update.
- **Right Column (Candidate Matches)**:
  - **Match Cards**: Ranked profiles showing match score percentage, job title, company, location, experience, concrete evidence ("Why this candidate matches"), and skill tags.
  - **1-Click Feedback**: `Strong match` and `Not a fit` buttons to immediately calibrate results.
- **Header Actions**:
  - **Freeze / Unfreeze Search**: Lock candidate results to prevent drift, or unfreeze to continue refining.
  - **New Search**: Reset the entire session back to a clean state.

---

##  Engineering Decisions: What Was Prioritised & What Was Cut

### What Was Prioritised (and Why)

1. **Rule-Based Safeguards for Experience & Role Limits (`route.js`)**
   - *Why*: AI sometimes gets numbers wrong (like forgetting to reset minimum experience when you say *"less than 8 years"*). We added simple code checks on top of the AI output to make sure experience limits and job roles are always 100% accurate.

2. **Filter First in Code, Score Later with AI (`route.js`)**
   - *Why*: Sending dozens of raw candidate profiles to an AI is slow and expensive. We first filter candidates in fast code using hard rules (years of experience, role, and location), and then ask the AI to score only the top matching profiles.

3. **Real, Fact-Based Reasons for Every Match (`prompt.js`)**
   - *Why*: Recruiters need to know *why* a candidate fits. Our scoring prompt requires the AI to mention real details from the candidate's profile—like past companies, tools used, and years of experience—instead of vague praise.

4. **Step-by-Step Search Updates with a Clear Changelog (`prompt.js` & `route.js`)**
   - *Why*: Sourcing talent is an ongoing conversation. When you give feedback, the prompt updates your criteria without erasing your earlier requirements, and shows a short summary of what changed.

5. **Smart Fallback When No Candidates Match (`route.js`)**
   - *Why*: A blank screen wastes time. If zero candidates match your exact search, the system gently broadens secondary details (like location or company type) and tells you with a clear note, while never breaking your required experience limits.

---

### What Was Cut (and Why)

1. **Asking the AI to Filter Every Profile Directly**
   - *Why*: Having an AI read all candidate records to filter them is slow and can lead to missed requirements. Filtering candidates directly in code first is much faster and completely reliable.

2. **Heavy AI Libraries (like LangChain)**
   - *Why*: Big AI framework libraries add extra bloat, slow down responses, and make debugging harder. Simple, direct API calls keep searches fast and easy to maintain.

3. **Keyword-Only or Vector Similarity Search**
   - *Why*: Matching candidates only by similar words often brings up buzzwords while missing hard requirements (like showing someone with 2 years of experience for a senior job). Structured criteria plus rubric scoring gives much better results.

4. **Databases & User Logins**
   - *Why*: Requiring database setup or sign-ups creates friction. Storing candidate profiles in a simple local file lets anyone clone the project, add their API key, and test it in seconds.

---

## Try These Prompts to Evaluate

- **DevOps / Cloud Role:**
  > *"DevOps engineer with minimum 4 years experience who has worked with Kubernetes and AWS, based in Bangalore."*
- **Refinement Feedback:**
  > *"Candidate #1 is a great fit, but prioritize candidates with startup infrastructure experience."*
- **Backend / Database Role:**
  > *"RDS developers with 4-7 years of experience who have worked at product startups."*
