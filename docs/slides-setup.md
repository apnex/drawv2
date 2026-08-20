# Google Slides setup

One-time Google credential setup for `draw`'s one-way push to Slides.\
Takes about five minutes, and only has to be done once per machine.

The push itself is described in the README under [Google Slides sync](../README.md#google-slides-sync).

---

## Prerequisites

- A Google account that can create a Cloud project.
- A presentation you own, or can edit.

Nothing is installed: `draw` speaks to the Slides API over `fetch`, with no added dependency.

---

## Create the OAuth client

Enable the API and mint a desktop client:

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create or pick a project.
2. Enable the **Google Slides API** for it.
3. Configure the OAuth consent screen as **External**, and add yourself as a test user.
4. Go to **Credentials -> Create credentials -> OAuth client ID -> Desktop app**.
5. Download the client JSON.

---

## Place the credentials

Save the downloaded file as `secrets/google-credentials.json`:
```sh
mkdir -p secrets
mv ~/Downloads/client_secret_*.json secrets/google-credentials.json
```

`secrets/` is gitignored, and is kept separate from the diagram data directory so a mounted data volume never carries credentials.

Two environment variables override the defaults:

| Variable | Overrides |
|---|---|
| `GOOGLE_OAUTH_CREDENTIALS` | the path to the client JSON |
| `SECRETS_DIR` | the whole directory (also `--secrets <dir>`) |

---

## Authorize

Paste a presentation URL into the header field and press the `slides` button.\
The editor opens a Google consent tab; approve it, then push again.

The refresh token is written to `secrets/google-token.json` with mode `600`, and the directory is created on first authorization.\
It is a runtime artifact: delete it to force re-authorization.\
Override its location with `GOOGLE_OAUTH_TOKEN`.

If your OAuth redirect differs from `http://localhost:<port>/oauth2callback`, set `OAUTH_REDIRECT_URI`.

---

## Decimal-exact geometry

The push adapts to the deck's page size automatically, so nothing here is required.

For metric geometry that lands on round numbers, set the deck to a custom page of 19.2 x 10.8 cm under **File -> Page setup**.\
One canvas pixel is then 0.1mm and a grid cell is 6mm.\
With Slides' Format options set to *From: Center*, the position readout equals the model coordinate divided by 100, in cm.

Default-size decks render exactly as they did before.\
Switching back is just re-pushing after restoring the page size.
