# Coursemap — personal grade tracker

A no-framework grade tracker that calculates your current grade, ranks what to
focus on next, and lets you simulate scores and goals. Data is saved in your
browser with LocalStorage.

## Run it

Just open `index.html` in a browser (double-click works). No build step, no
server. The scripts are plain `<script>` tags (not ES modules) on purpose, so
opening from `file://` never hits a CORS error.

## Folder structure

```
academic-tracker/
├── index.html            page structure + script load order
├── css/
│   └── styles.css        theme tokens at the top, components below
└── js/
    ├── storage.js        ← the ONLY file that knows where data lives
    ├── models.js         factory functions = the data shape
    ├── calculations.js   pure math: grade, risk, recommendations, what-if, goal
    ├── charts.js         tiny canvas line + bar charts (no library)
    ├── ui.js             state → HTML strings (no logic, no saving)
    └── main.js           controller: loads, renders, handles events
```

## Adding a backend or Canvas later

`storage.js` is the seam. Today `load()` / `save()` read and write LocalStorage.
To sync with a server or Canvas, change ONLY those two functions to call
`fetch()` (e.g. a Canvas adapter that maps assignments → scores). The rest of
the app doesn't care where the data came from, so nothing else needs to change.

## Tuning the recommendation engine

The risk formula lives in `Calc.categoryRisk` in `calculations.js`:

```
risk = impact * (0.6 * gap + 0.4 * doubt) * 100
```

Raise the `0.4` if you want your confidence ratings to matter more; adjust the
`riskLevel()` thresholds to change when something is labeled high / medium / low.
```
