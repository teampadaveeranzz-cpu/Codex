# ZEVON ENTERTAINMENT website

A responsive, multi-page website for ZEVON Entertainment, with enquiry forms, a private owner dashboard, SEO metadata, and two hosting options: Netlify (recommended) or a Python standard-library server. It has no paid website-builder dependency.

## Publish with Netlify

The site is prepared for Netlify Functions and Netlify Blobs. The static pages are built into `dist/`; forms, admin login, enquiries, and owner-uploaded images use server-side functions and persistent Blobs storage. Enquiry storage and uploaded photos persist across deploys.

1. Put this project in a GitHub repository and import that repository from your Netlify dashboard, or use the Netlify CLI. Netlify reads the included `netlify.toml` build settings.
2. In Netlify, add the required private environment variables under **Site configuration → Environment variables**. Set `ADMIN_EMAIL` to the owner's login email; generate the password hash locally with `python3 scripts/hash_admin_password.py` and add its printed `ADMIN_PASSWORD_SALT` and `ADMIN_PASSWORD_HASH` values; set `SESSION_SECRET` to a random secret of at least 32 characters. Never send passwords or secret values in chat or commit them to the repository.
3. Deploy the site. The private admin page is at `/admin`. There is no public sign-up or default password.
4. Optional email alerts need `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `OWNER_EMAIL`. Enquiries are still saved to the dashboard if email is not configured or delivery fails.

Set these values in Netlify's private settings, not in `netlify.toml`. Redeploy after changing environment variables. Netlify's current new Free plan lists a monthly usage cap; check your account's plan and usage before launch. The site may be paused if a plan's limit is reached.

The Netlify admin password is never stored in the deployed files: the helper only prints a salt and PBKDF2-SHA256 hash for you to copy into private settings. Use a unique, strong admin password and keep `SESSION_SECRET` private.

## Run locally

Requires Python 3.10 or newer.

```sh
python3 server.py
```

Open `http://127.0.0.1:8000`. The server creates `data/zevon.sqlite3` on first run. Enquiries are stored there.

## Owner dashboard

The dashboard is at `/admin`, and is not linked from the public website. There is no sign-up flow or default password. Before the first launch, set these environment variables for the server process:

- `ADMIN_EMAIL`: the owner's login email.
- `ADMIN_PASSWORD`: a unique password at least 14 characters long.
- `SESSION_SECRET`: a random secret of at least 32 characters. Keep it stable across restarts so existing sessions remain valid.

For example, set those values in the hosting provider's private environment settings. Do not put credentials in public files or commit them to source control. The configured owner is stored with a PBKDF2-SHA256 password hash. On startup, setting a different owner email or password replaces the previous owner and expires existing sessions. The app does not expose public registration.

The dashboard can list enquiries, update enquiry status, export a CSV, edit the homepage headline and introduction, update public phone/email details, choose the hero robot, and replace the product illustrations with real JPG, PNG, WebP or AVIF photos. Image uploads are limited to 4 MB and checked against their file signatures.

## Email notifications

Enquiries are always stored first. To send email notifications, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `OWNER_EMAIL` in private server settings. Use the SMTP provider's TLS settings. If email is not configured or an SMTP delivery fails, the enquiry remains in the admin dashboard.

## Production deployment

For the optional Python server, run behind a maintained HTTPS reverse proxy or a hosting platform that provides TLS. Set `APP_ENV=production`, `HOST=0.0.0.0`, `PUBLIC_BASE_URL=https://your-domain.example`, and a stable random `SESSION_SECRET`. Configure `ZEVON_DATA_DIR` to a persistent private directory outside the public web root, and keep that directory backed up with access restricted to the app owner. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and email notification settings through private environment variables. Do not expose port 8000 directly to the public internet without HTTPS and network controls. If the reverse proxy is trusted to overwrite `X-Forwarded-For`, list its exact source IPs in `TRUSTED_PROXY_IPS`; otherwise the app uses the direct connection address for its in-process rate limits.

The app sends security headers, uses same-origin requests, HttpOnly/SameSite session cookies, CSRF checks on admin writes, login and enquiry rate limits, honeypot spam checks, server-side field validation, parameterized SQLite queries, and hashed admin passwords. The Netlify version stores private records and sessions separately from public images. Netlify limits request/response size, so photo uploads are capped at 4 MB. Rate limits in the Python option are in-process; a multi-instance deployment should place rate limiting at the proxy or hosting layer as well.

## Content notes

The listed phone (`+91 90876 9065`) and email (`zevonentertainment@gmail.com`) are taken from the supplied brief and should be confirmed by the owner. Service areas and official social links are not claimed until confirmed. The site does not publish unverified robot specifications, prices, certifications, customer names, or testimonials. The privacy and terms pages are starter copy and should receive owner/legal review before production launch.

Robot and venue artwork currently uses original inline SVG illustrations because an image-generation service was not available in this workspace. The admin dashboard supports replacing those illustrations with approved product photos later.
