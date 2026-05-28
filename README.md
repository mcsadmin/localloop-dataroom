# Local Loop Merseyside — Data Room

Private data room for Local Loop Merseyside, deployed to Netlify at `dataroom.localloop-merseyside.co.uk`.

## Structure

```
public/
  index.html              ← Data room index (visible after login)
  login.html              ← Password gate
  logout.html             ← Clears cookie and redirects to login
  financial-model/        ← Built React app (Financial Forecast Calculator)
    index.html
    assets/
netlify/
  edge-functions/
    auth-gate.ts          ← Protects every route with a signed cookie
netlify.toml              ← Build config, redirects, edge function binding
```

## Adding new documents

Place files in `public/` and add a card to `public/index.html`. The auth gate protects everything automatically.

## Deployment

1. Connect this repo to a Netlify site
2. Set the custom domain to `dataroom.localloop-merseyside.co.uk`
3. Set these environment variables in **Netlify → Site settings → Environment variables**:

   | Variable | Description |
   |---|---|
   | `DATAROOM_PASSWORD` | The passphrase visitors must enter |
   | `COOKIE_SECRET` | A random string ≥ 32 characters used to sign the auth cookie |

4. Deploy. The edge function handles auth automatically — no build step needed.

## Updating the financial model

When the Manus-hosted calculator is updated:

1. In the Manus project, run: `npx vite build --base=/financial-model/`
2. Copy `dist/public/*` into `public/financial-model/` in this repo (remove `__manus__/` if present)
3. Commit and push — Netlify will auto-deploy

## Rotating the password

Change `DATAROOM_PASSWORD` in Netlify environment variables and trigger a redeploy (or just save — edge functions pick up env var changes on next request).
