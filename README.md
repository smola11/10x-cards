# 10x-cards

## Table of Contents

1. [Project Description](#project-description)  
2. [Tech Stack](#tech-stack)  
3. [Getting Started Locally](#getting-started-locally)  
4. [Available Scripts](#available-scripts)  
5. [Project Scope](#project-scope)  
6. [Project Status](#project-status)  
7. [License](#license)  

---

## Project Description

**10x-cards** is a web application for quickly creating and managing educational flashcard sets. It leverages large language models via an API to automatically generate question-and-answer flashcards from user-supplied text, while also supporting manual creation, editing, and deletion. The MVP includes basic user authentication, spaced-repetition integration, scalable data storage, and generation analytics, all within a GDPR-compliant framework.

## Tech Stack

- **Frontend**: Astro 5, React 19, TypeScript 5  
- **Styling**: Tailwind CSS 4, Shadcn/ui, Radix UI Slot  
- **Backend**: Supabase (PostgreSQL, Auth, BaaS SDK)  
- **AI Integration**: Openrouter.ai (multi-model gateway with cost controls)  
- **CI/CD & Hosting**: GitHub Actions, Docker on DigitalOcean  

## Getting Started Locally

### Prerequisites

- Git  
- Node.js v22.14.0 (use `.nvmrc`)  
- npm (bundled with Node.js)  

### Setup

1. Clone the repository  
   ```bash
   git clone https://github.com/<your-org>/10x-cards.git
   cd 10x-cards
   ```

2. Switch to the project's Node version  
   ```bash
   nvm use
   ```

3. Install dependencies  
   ```bash
   npm install
   ```

4. Create a `.env` file in the project root with the following variables:  
   ```env
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_KEY=<your-supabase-key>
   OPENROUTER_API_KEY=<your-openrouter-api-key>
   ```

5. Start the development server  
   ```bash
   npm run dev
   ```

Open your browser to `http://localhost:3000` to view the app.

## Available Scripts

| Command             | Description                        |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Start Astro development server     |
| `npm run build`     | Build for production               |
| `npm run preview`   | Preview production build           |
| `npm run astro`     | Run Astro CLI                      |
| `npm run lint`      | Run ESLint on all files            |
| `npm run lint:fix`  | Run ESLint and auto-fix            |
| `npm run format`    | Format code with Prettier          |

## Project Scope

### In Scope (MVP)
- Automatic flashcard generation via LLM API  
- Manual creation, editing, deletion of flashcards  
- User registration, login, and account deletion  
- Basic spaced-repetition session view (using an existing algorithm)  
- Secure, scalable storage of users and flashcards  
- Generation analytics (AI-generated vs. accepted flashcards)  
- GDPR compliance (data access/removal on request)  

### Out of Scope
- Custom spaced-repetition algorithm  
- Gamification features  
- Mobile applications  
- Import from PDF/DOCX (or other formats)  
- Public API  
- Flashcard sharing between users  
- Advanced notifications or keyword search  

## Project Status

This project is in **MVP development**. Features are actively being built and tested. Contributions are welcome!

## License

> **Note:** No license file found. Please add a `LICENSE.md` (e.g., [MIT License](https://choosealicense.com/licenses/mit/)) to clarify usage rights.
