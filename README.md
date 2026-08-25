# 🎬 moveTrack

A modern, single-page **movie tracker** built with **vanilla JavaScript** and **localStorage** — no backend, no build step, no dependencies to install. Clean, Google-style design using Tailwind and Lucide icons.

## Features

- **CRUD movies** — title, YouTube URL, published date (admin only)
- **Play videos** — embedded YouTube player in a modal
- **Anonymous engagement** — anyone can **comment**, **like**, and **share on WhatsApp**
- **Admin-only management** — only a signed-in admin can add / edit / delete movies and delete comments
- **Local persistence** — everything is saved in the browser's `localStorage`
- **Responsive** — works on mobile and desktop
- **Live search** — filter movies by title

## How to run

Just open `index.html` in any modern browser. That's it.

> Tailwind and Lucide load from a CDN, so keep an internet connection the first time.
> For the cleanest experience you can also serve it locally:
> ```bash
> # Python
> python3 -m http.server 8000
> # then visit http://localhost:8000
> ```

## Admin access

Click **Admin** in the top-right and enter the password:

```
admin123
```

Once signed in you'll see the **Add movie** button and edit/delete controls on each card.

### Changing the password
Open `app.js` and edit this line near the top:
```js
const DEFAULT_ADMIN_PASSWORD = 'admin123';
```

> ⚠️ **Security note:** because this is a fully client-side app, the "admin" gate only hides the UI controls — the password lives in the browser. It's fine for a demo, a portfolio piece, or a trusted personal tool, but it is **not** real server-side security. For a public/production app you'd move movie management behind a real backend with authentication.

## Data & reset

All data lives under these `localStorage` keys:
- `movetrack.movies` — the movie list, comments and likes
- `movetrack.liked` — which movies this browser has liked
- `movetrack.admin` — admin session flag
- `movetrack.pass` — admin password

To wipe everything and start fresh, clear the site data in your browser, or run in the console:
```js
Object.keys(localStorage).filter(k => k.startsWith('movetrack.')).forEach(k => localStorage.removeItem(k));
location.reload();
```

## Files

```
moveTrack/
├── index.html   # markup + Tailwind config
├── app.js       # all logic (storage, CRUD, player, comments, likes, share)
└── README.md
```

Enjoy 🍿
