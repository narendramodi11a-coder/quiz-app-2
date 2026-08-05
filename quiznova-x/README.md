# QuizNova X

An AI-powered quiz and study platform. Generate quizzes, flashcards, mind maps, roadmaps and more — all from your own study material, powered by Google Gemini.

## Setup

Make sure you have Node.js installed, then serve the static site:

```bash
# Install the static server globally (one-time)
npm install -g serve

# Start the server from inside the project folder
serve
```

The app will be available at the URL printed by `serve` (default `http://localhost:3000`).

## Adding your Gemini API key

1. Get a free API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Open `js/config.js` and replace the placeholder value:

```js
GEMINI_API_KEY: "your-gemini-api-key-here",
```

3. Reload the app. The AI features (AI Tutor, Summarizer, Quiz generation, Mind Maps) will now work.

> Note: This is a static, client-side app, so the key is stored in the browser. Keep the key limited to demo/development use.

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
