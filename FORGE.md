# Deploying github-stats to Laravel Forge

This is a standard Next.js + MySQL app. Forge provisions the VPS, Nginx, and
MySQL; we run Next.js as a Node daemon on port 3000 behind Nginx.

## 1. Create the site on Forge

1. In your server, add a new site:
   - **Root Domain**: `stats.klasio.dev`
   - **Project Type**: **General Node.js App** (not PHP)
   - **Web Directory**: `/` (Next.js standalone handles routing)
2. After the site is created, clone the repo: Site → **Git Repository** →
   provider, repo, `main` branch. **Uncheck** "Install Composer dependencies".

## 2. Create a MySQL database

Server → **Databases** → New Database:

- Name: `github_stats`
- User: `github_stats`
- Password: (generate a strong one)

Note the host (usually `127.0.0.1`), user, password, and database name.

## 3. Environment variables

Site → **Environment**. Paste this, filling in your values:

```env
NODE_ENV=production

DATABASE_URL=mysql://github_stats:YOUR_DB_PASSWORD@127.0.0.1:3306/github_stats

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

GITHUB_SYNC_TOKEN=...

GITHUB_ORG=klasio

# openssl rand -hex 32
SESSION_SECRET=...
```

- **GITHUB_CLIENT_ID / _SECRET**: from your GitHub OAuth App. Update the
  app's Authorization callback URL to
  `https://stats.klasio.dev/api/auth/callback`.
- **GITHUB_SYNC_TOKEN**: a fine-grained PAT with Read access to all klasio
  repos (Contents, Issues, Metadata, Pull requests), or a classic PAT with
  `repo` + `read:org` scopes.
- **SESSION_SECRET**: run `openssl rand -hex 32` locally and paste.

## 4. Deploy script

Site → **Deployment** → **Deploy Script**. Replace the default with:

```bash
cd $FORGE_SITE_PATH
git pull origin $FORGE_SITE_BRANCH

# Install deps (use npm ci for reproducible builds)
npm ci

# Run any pending DB migrations
npm run db:migrate

# Build the Next.js app
npm run build

# Restart the Node daemon (see step 5)
sudo -S supervisorctl restart github-stats:* </dev/null || true
```

Click **Deploy Now** once to run the initial deploy.

## 5. Run Next.js as a daemon

Site → **Daemons** → New Daemon:

- **Command**: `node .next/standalone/server.js`
- **User**: `forge`
- **Directory**: `/home/forge/stats.klasio.dev`

Forge will set up a supervisor process that restarts the app automatically.
Next.js listens on port 3000 by default.

## 6. Nginx reverse proxy

Site → **Edit Nginx Configuration**. Replace the `location /` block with:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

Save and Forge reloads Nginx automatically.

## 7. SSL

Site → **SSL** → Let's Encrypt → enter the domain → Obtain.

## 8. First backfill

SSH into the server, or use Forge's "Site Commands":

```bash
cd /home/forge/stats.klasio.dev
npm run backfill
```

Runs the full historical sync (~5–10 minutes for klasio). When it finishes,
`https://stats.klasio.dev/overview` will show real data.

## 9. Schedule incremental sync

Server → **Scheduler** → New Scheduled Job:

- **Frequency**: Custom → `*/15 * * * *`
- **Command**: `cd /home/forge/stats.klasio.dev && npm run sync:incremental >> storage/sync.log 2>&1`
- **User**: `forge`

And a nightly full reconcile:

- **Frequency**: Daily → 03:00
- **Command**: `cd /home/forge/stats.klasio.dev && npm run sync:full >> storage/sync.log 2>&1`
- **User**: `forge`

Create `storage/` on the server if it doesn't exist (`mkdir storage`).

## 10. Verify

```bash
# Check the daemon is up
sudo supervisorctl status github-stats:*

# Check the sync log
tail -f /home/forge/stats.klasio.dev/storage/sync.log

# Hit the site
curl -I https://stats.klasio.dev/
```

## Rollback

Every deploy creates a new git commit checkpoint. To roll back:

```bash
cd /home/forge/stats.klasio.dev
git checkout <previous-commit-sha>
npm ci && npm run build
sudo supervisorctl restart github-stats:*
```

Schema migrations are additive; rolling back code without rolling back the
schema is safe.
