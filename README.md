# MediCore — Hospital Management Dashboard (Frontend, DA2)

A frontend-only implementation for the Hospital Management DBMS project.
No login, no registration, no authentication, no DA3 query window, no
hardcoded database data — everything shown on screen comes from live
calls to the Spring Boot / Oracle backend described in the project brief.

## Folder structure

```
frontend/
├── index.html              # App shell: sidebar, header, all 9 page sections, modal, toasts
├── css/
│   └── styles.css          # All styling (design tokens + components + responsive rules)
├── js/
│   ├── config.js           # API_BASE_URL — the ONLY place the backend URL is set
│   ├── api.js               # fetch() wrapper: HMD_API.get/post/put/del + error normalization
│   ├── utils.js             # Toasts, modal/drawer, formatting helpers, table state toggler
│   ├── router.js            # Hash-based navigation (#dashboard, #patients, …)
│   ├── app.js               # Bootstraps icons, sidebar toggle, search, refresh, API status
│   └── pages/
│       ├── dashboard.js      # Stat cards + 4 Chart.js charts
│       ├── patients.js       # Patients CRUD
│       ├── doctors.js        # Doctors CRUD (dynamic specialization list)
│       ├── hospitals.js      # Hospitals CRUD
│       ├── consultations.js  # Consultations CRUD (consultationMode mapping, dynamic dropdowns)
│       ├── prescriptions.js  # Prescriptions CRUD (dynamic consultation/medicine/test dropdowns)
│       ├── medicines.js      # Medicines CRUD
│       ├── tests.js          # Lab tests CRUD
│       └── payments.js       # Payments CRUD (dynamic consultation dropdown)
└── README.md
```

Everything lives under `frontend/` — `database/` and `backend/` are
untouched, as required.

## How to run it

This is static HTML/CSS/JS with no build step.

1. Make sure your Spring Boot backend is running (defaults to
   `http://localhost:8080`).
2. Serve the `frontend/` folder with any static file server, e.g.:
   ```
   cd frontend
   python3 -m http.server 5500
   ```
   (Opening `index.html` directly with `file://` also works for most
   browsers, but a local server avoids occasional CORS/module quirks.)
3. Visit `http://localhost:5500` in your browser.

The sidebar footer shows a live "Backend connected / unreachable"
indicator so you can immediately see if the API isn't reachable.

## Configuring the backend API URL

Everything goes through one constant in `js/config.js`:

```js
const API_BASE_URL = window.HMD_API_BASE_URL || 'http://localhost:8080';
```

To point at a different backend without editing the file, set
`window.HMD_API_BASE_URL` in an inline `<script>` tag in `index.html`
before `config.js` loads. `js/api.js` is the only file that reads
`API_BASE_URL`, and every page module calls through it — no fetch call
anywhere else in the app hardcodes a host.

## How API calls and dynamic data loading work

`js/api.js` exposes `HMD_API.get/post/put/del(path, body)`. Every page
module (`js/pages/*.js`) follows the same pattern:

1. On `load()`, call `setTableState(prefix, 'loading')` and show the
   loading row.
2. `await HMD_API.get('/api/...')`.
3. On success, store the response array in a module-local variable and
   call `render()`, which shows `'empty'` if the array (or the current
   filter/search result) has zero rows, otherwise builds `<tr>` markup
   directly from the fetched objects and shows `'ready'`.
4. On failure, `setTableState(prefix, 'error')` and a toast with a
   friendly message (never a raw stack trace — see `api.js`'s
   `_friendlyError`).

Dropdowns that reference another entity (Patient/Doctor on
Consultations; Consultation/Medicine/Test on Prescriptions;
Consultation on Payments; Specialization on Doctors) are populated by
fetching the related list (`/api/patients`, `/api/doctors`,
`/api/consultations`, `/api/medicines`, `/api/tests`) right before the
form opens, or alongside the page's own data — never from a fixed
in-code array.

The dashboard (`js/pages/dashboard.js`) fetches five endpoints in
parallel (`/api/dashboard/summary` and the four breakdown endpoints)
and renders the 5 stat cards and 4 Chart.js charts from whatever comes
back, with a matching empty state per chart if an endpoint returns no
rows.

## How CRUD works

Each entity page has:
- **Add** — "+ Add …" button opens a right-side drawer form
  (`HMD_MODAL.open`) and `POST`s the form body to the collection
  endpoint on save.
- **Edit** — the pencil icon in a row's Actions column opens the same
  drawer pre-filled with that row's data and `PUT`s to
  `/api/<entity>/{id}` on save.
- **Delete** — the trash icon opens a confirmation dialog
  (`confirmDialog`) and `DELETE`s `/api/<entity>/{id}` on confirm.

After any successful mutation the page shows a toast and calls its own
`load()` again to refresh the table from the backend. The dashboard is
not force-refreshed automatically after every mutation (to avoid
excess calls); use the header's refresh button, or simply navigate to
Dashboard, to see updated totals/charts.

Client-side validation only checks that required fields are filled in
before submitting — all real validation (duplicates, foreign keys,
Oracle constraints) happens server-side, and the resulting error
message is surfaced via a toast using the backend's message when
available.

## How `consultationMode` maps to Oracle `consultation_mode`

The Oracle `CONSULTATION` table's column is `consultation_mode`, not
`mode`. This frontend **only ever reads/writes the JSON field
`consultationMode`** — see `js/pages/consultations.js`. The Spring Boot
backend is expected to map:

```
JSON body: { "consultationMode": "VIDEO", ... }
        ↓
Backend DTO/entity field: consultationMode
        ↓
Oracle column: CONSULTATION.consultation_mode
```

The consultation form also conditionally shows **Video Link**, **Call
Number**, or **Chat Transcript ID** depending on which mode is
selected, and only sends the field relevant to that mode.

## How `feedbackComment` maps to Oracle `feedback_comment`

A dedicated feedback UI wasn't in the required navigation, so it isn't
included as a page, but the mapping rule from the brief is documented
here for whoever wires it up next: if/when a feedback form is added,
the frontend field must be named `feedbackComment` (never `comment`),
so it maps the same way:

```
JSON body: { "feedbackComment": "...", "rating": 4 }
        ↓
Backend field: feedbackComment
        ↓
Oracle column: FEEDBACK.feedback_comment
```

Rating should be constrained to 1–5 in whatever form is built.

## Design notes

- Palette: deep teal (`#0A2C2A` sidebar, `#16786F` primary action) with
  a warm clay accent (`#D9714E`) reserved for a single stat card, kept
  deliberately restrained rather than a generic multi-color SaaS kit.
- Typography: Inter for all UI text; Source Serif 4 only for the large
  dashboard stat numbers, to give them a bit of editorial weight
  without introducing a second UI typeface.
- Icons: Lucide (loaded from cdnjs). Charts: Chart.js (loaded from
  cdnjs).
- Every table has explicit loading / empty / error states, and the
  sidebar shows a live backend-reachability indicator.
