# public/ — the pages that must be reachable WITHOUT signing in

Three pages, served from `gs://draw-apnex-io-public` through the load balancer, deliberately outside
IAP. Object names match filenames exactly, so `public/about` is served at `draw.apnex.io/about`.

## Why they are not application routes

IAP protects a backend service whole; it has no path exclusion. An application route is therefore
behind sign-in by construction, and Google's OAuth verification fetches these URLs anonymously — it
would receive a redirect to `accounts.google.com` and fail. Serving them from a bucket also means
they survive the application being down, and need no code.

They are here rather than only in the bucket because a page that exists only in cloud storage is
unversioned, unreviewable, and invisible to anyone reading this repository.

## What each one satisfies

Google requires all three links on an external app before it can be submitted for verification, and
verification is what makes a custom app name and logo appear on the consent screen.

| File      | Serves at  | Requirement it meets |
|---|---|---|
| `about`   | `/about`   | Homepage. Must describe the app's functionality and link to the privacy policy. It may NOT be only a login page, which is why `/` cannot be used: `/` is the application and returns a sign-in redirect. |
| `privacy` | `/privacy` | Privacy policy. Must disclose how Google user data is accessed, used, stored and shared. |
| `terms`   | `/terms`   | Terms of service. |

## Publishing a change

```sh
gcloud storage cp public/about gs://draw-apnex-io-public/about \
  --content-type="text/html; charset=utf-8" --project=labops
```

The `--content-type` is not optional: uploaded without it the object is served as
`application/octet-stream` and the browser downloads the file instead of rendering it.
