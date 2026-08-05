# MindForge

An AI-powered quiz and study platform. Generate quizzes, flashcards, mind maps, roadmaps and more — all from your own study material, powered by Google Gemini.

## Local setup

Make sure you have Node.js installed, then install dependencies and start the server:

```bash
npm install
npm run dev
```

The app is available at `http://localhost:3000`.

## Gemini configuration

Production requests run through a server-side Netlify Function and Netlify AI Gateway. Do not add an API key to browser JavaScript or `js/config.js`.

Netlify injects the required Gemini credentials into the function after the site has a production deploy and AI features are enabled for the project. A manually configured `GEMINI_API_KEY` overrides gateway injection, so remove that environment variable unless it is a direct Google Gemini API key intentionally used for local development.

For local Express development only, set a direct Google Gemini API key in the server environment as `GEMINI_API_KEY`. Never commit it to the repository.

## File structure

```
quiznova-x/
├── index.html              # Single-page shell (sidebar, topbar, views)
├── README.md
├── assets/icons/           # Custom icons
├── css/
│   ├── main.css            # Base layout, sidebar, topbar
│   ├── themes.css          # Design tokens (dark/light)
│   ├── components.css      # Reusable components
│   ├── views.css           # Per-view styles
│   └── responsive.css      # Mobile breakpoints
├── js/
│   ├── app.js              # Entry point
│   ├── state.js            # Global app state
│   ├── storage.js          # localStorage persistence
│   ├── utils.js            # Helpers
│   ├── ai.js               # Gemini API integration
│   ├── ui.js               # DOM / view rendering
│   ├── quiz.js             # Quiz engine
│   ├── flashcards.js       # Flashcards
│   ├── notes.js            # Notes
│   ├── roadmap.js          # Study roadmap
│   ├── tutor.js            # AI tutor chat
│   ├── summarizer.js       # Text summarizer
│   ├── mindmap.js          # Mind maps
│   ├── skilltree.js        # Skill tree
│   ├── analytics.js        # Progress analytics
│   ├── gamification.js     # XP / achievements
│   ├── mascot.js           # Mascot
│   ├── material.js         # Study material
│   └── mistakes.js         # Mistake journal
└── data/defaults.json      # Default seed data
```

## Credits

Developed by medhansh khatri.
