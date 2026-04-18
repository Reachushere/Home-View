import { sendGmail } from '../server/gmail';

const html = `
<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 0 auto; color: #1a1a1a; line-height: 1.55;">
  <h1 style="color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 8px;">UniCal Pi Handoff — What To Do</h1>
  <p style="background: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 4px;">
    <strong>Why this email exists:</strong> Replit is being shut down. Your Pi at <code>https://uni-cal.app</code> is now the only place UniCal runs. Right now your Pi is missing 3 important secrets in its <code>.env</code> file, which is why Spotify, the Study Assistant chat, and the essay generator aren't working. Below is exactly how to fix it. Copy commands one at a time.
  </p>

  <h2 style="color: #1e40af;">Current Status</h2>
  <p>Your Pi <code>.env</code> currently has these (good):</p>
  <ul>
    <li><code>DATABASE_URL</code> ✅</li>
    <li><code>HOME_ASSISTANT_TOKEN</code> ✅</li>
    <li><code>DEPLOYED_APP_URL</code> ✅</li>
    <li><code>GOOGLE_SECOND_ACCOUNT_CLIENT_ID</code> ✅</li>
    <li><code>GOOGLE_SECOND_ACCOUNT_CLIENT_SECRET</code> ✅</li>
    <li><code>SITE_PASSWORD</code> ✅</li>
    <li><code>SITE_PASSWORD_4201</code> ✅</li>
    <li><code>SITE_PASSWORD_1010</code> ✅</li>
  </ul>
  <p><strong>Missing (you need to add these):</strong></p>
  <ul>
    <li><code>OPENAI_API_KEY</code> — needed for Study Assistant chat + essay generator</li>
    <li><code>SPOTIFY_CLIENT_ID</code> — needed for the Spotify widget to connect</li>
    <li><code>SPOTIFY_CLIENT_SECRET</code> — same</li>
    <li>(Optional) <code>GITHUB_PERSONAL_ACCESS_TOKEN3</code> — only if you want BrynAssist to push code commits for you</li>
  </ul>

  <h2 style="color: #1e40af;">Step 1 — Get the actual secret values</h2>
  <p>You need to copy real values from each website. <strong>Do this first</strong> so when you open the file you can paste them in one go.</p>

  <h3>1a. OpenAI API Key</h3>
  <ol>
    <li>Go to <a href="https://platform.openai.com/api-keys">https://platform.openai.com/api-keys</a></li>
    <li>Sign in (your OpenAI account)</li>
    <li>Click <strong>"Create new secret key"</strong></li>
    <li>Name: <code>UniCal Pi</code> → Create</li>
    <li>Copy the key starting with <code>sk-proj-...</code> — <strong>save it in a notes app right now</strong>, it only shows once</li>
  </ol>

  <h3>1b. Spotify Client ID + Secret</h3>
  <ol>
    <li>Go to <a href="https://developer.spotify.com/dashboard">https://developer.spotify.com/dashboard</a></li>
    <li>Sign in with the Spotify account you use for UniCal</li>
    <li>Click your existing UniCal app (or create one if there isn't one — name: <code>UniCal</code>)</li>
    <li>Click <strong>Settings</strong> (top right)</li>
    <li>Copy <strong>Client ID</strong> — save it</li>
    <li>Click <strong>"View client secret"</strong> → copy it — save it</li>
    <li><strong>VERY IMPORTANT:</strong> Scroll to <strong>Redirect URIs</strong>. Make sure <code>https://uni-cal.app/api/spotify/callback</code> is in the list (exactly that, no trailing slash). If not, click Edit → add it → Save. Without this, the green "Reconnect" button won't work.</li>
  </ol>

  <h3>1c. (Optional) GitHub token</h3>
  <p>Only if you want BrynAssist to commit code for you. Skip if not.</p>
  <ol>
    <li>Go to <a href="https://github.com/settings/tokens">https://github.com/settings/tokens</a></li>
    <li><strong>Generate new token (classic)</strong></li>
    <li>Note: <code>UniCal Pi</code>, expiration: <code>No expiration</code>, scope: check <code>repo</code></li>
    <li>Generate → copy the <code>ghp_...</code> token — save it</li>
  </ol>

  <h2 style="color: #1e40af;">Step 2 — SSH into the Pi</h2>
  <p>From a Mac/PC terminal:</p>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">ssh byhomeyyz@raspberrypi.local</pre>
  <p>Or if you're already at the Pi keyboard, just open a terminal.</p>

  <h2 style="color: #1e40af;">Step 3 — Add the secrets to .env (the easy way)</h2>
  <p><strong>Why we're doing this:</strong> The Pi reads <code>.env</code> when the server starts to find passwords/keys for OpenAI, Spotify, etc. Adding lines here makes those services work again after restart.</p>
  <p>Run this <strong>one-line-at-a-time</strong>. Replace each <code>PASTE_HERE</code> with the real value you saved in Step 1. Keep the quotes if your value has special characters; otherwise no quotes needed.</p>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">cd ~/Home-View

echo 'OPENAI_API_KEY=PASTE_OPENAI_KEY_HERE' >> .env
echo 'SPOTIFY_CLIENT_ID=PASTE_SPOTIFY_ID_HERE' >> .env
echo 'SPOTIFY_CLIENT_SECRET=PASTE_SPOTIFY_SECRET_HERE' >> .env</pre>
  <p>If you want the optional GitHub one too:</p>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">echo 'GITHUB_PERSONAL_ACCESS_TOKEN3=PASTE_GHP_HERE' >> .env</pre>
  <p><strong>Why <code>echo ... &gt;&gt; .env</code>:</strong> the <code>&gt;&gt;</code> means "append a new line to the end of the file." Safer than nano because there's no chance of accidentally deleting existing lines.</p>

  <h2 style="color: #1e40af;">Step 4 — Verify the names show up</h2>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">cat .env | grep -v "^#" | grep -v "^$" | cut -d= -f1</pre>
  <p>You should now see <strong>11 lines</strong> (or 12 with GitHub), including <code>OPENAI_API_KEY</code>, <code>SPOTIFY_CLIENT_ID</code>, and <code>SPOTIFY_CLIENT_SECRET</code>. If you only see 8, the echo commands didn't run — try again.</p>

  <h2 style="color: #1e40af;">Step 5 — Pull the latest code (already pushed by Replit Agent)</h2>
  <p><strong>Why:</strong> A new green "Reconnect" button was added to the Spotify page so you can re-authorize Spotify with one tap.</p>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">cd ~/Home-View
git pull origin main</pre>
  <p>Should say "Updating ... Fast-forward" and mention <code>spotify-player.tsx</code>.</p>

  <h2 style="color: #1e40af;">Step 6 — Rebuild and restart the server</h2>
  <p><strong>Why:</strong> The server only reads <code>.env</code> when it starts. New env vars + new code → restart so they take effect.</p>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">npm run build
pm2 restart unical</pre>
  <p>If <code>pm2 restart unical</code> says "process not found", check your process name with <code>pm2 list</code> and use that name. If you don't use pm2, use whatever you normally use (systemd: <code>sudo systemctl restart unical</code>).</p>

  <h2 style="color: #1e40af;">Step 7 — Reconnect Spotify</h2>
  <ol>
    <li>Open <a href="https://uni-cal.app">https://uni-cal.app</a> on the Pi screen (or any browser)</li>
    <li>Go to the Spotify page</li>
    <li>Tap the green <strong>"Reconnect"</strong> button in the top-right</li>
    <li>Confirm the popup → it sends you to Spotify → sign in → it brings you back</li>
    <li>Spotify widget should now show "Connected" and start playing</li>
  </ol>

  <h2 style="color: #1e40af;">Step 8 — Sanity check</h2>
  <ul>
    <li>Try sending a message in the BrynAssist chat bubble. If it replies, OpenAI key works.</li>
    <li>Try generating an essay. If it streams, OpenAI key works.</li>
    <li>Spotify widget on dashboard shows song name, not "not connected".</li>
    <li>Home Assistant tiles (Cat Washroom, lights) respond when tapped.</li>
  </ul>

  <h2 style="color: #1e40af;">Troubleshooting</h2>
  <p><strong>Spotify still says not connected after Step 7:</strong></p>
  <ul>
    <li>Check the redirect URI in Spotify dashboard is <strong>exactly</strong> <code>https://uni-cal.app/api/spotify/callback</code></li>
    <li>Run <code>cat ~/Home-View/.env | grep SPOTIFY</code> — you should see two lines, ID and SECRET, with real values not <code>PASTE_HERE</code></li>
    <li>Check server logs: <code>pm2 logs unical --lines 50</code> — look for "Spotify" errors</li>
  </ul>
  <p><strong>BrynAssist chat shows "Error" or doesn't respond:</strong></p>
  <ul>
    <li>Run <code>cat ~/Home-View/.env | grep OPENAI</code> — must show one line with a real <code>sk-...</code> value</li>
    <li>Check OpenAI account has billing set up at <a href="https://platform.openai.com/account/billing">platform.openai.com/account/billing</a></li>
    <li>Check server logs: <code>pm2 logs unical --lines 50</code></li>
  </ul>
  <p><strong><code>git pull</code> says "Your local changes would be overwritten":</strong></p>
  <pre style="background:#1a1a1a; color:#e5e7eb; padding:12px; border-radius:6px; overflow-x:auto;">git stash
git pull origin main
git stash pop</pre>

  <h2 style="color: #1e40af;">Going Forward</h2>
  <p>Replit is gone. To make code changes from now on:</p>
  <ol>
    <li>Edit code in Cursor / Codex / Claude Code on your laptop</li>
    <li>Commit + push to GitHub <code>main</code> branch</li>
    <li>SSH to Pi → <code>cd ~/Home-View &amp;&amp; git pull &amp;&amp; npm run build &amp;&amp; pm2 restart unical</code></li>
  </ol>
  <p>The Pi is the source of truth. Always pull after a push.</p>

  <hr style="margin-top: 32px; border: 0; border-top: 1px solid #d1d5db;">
  <p style="color:#6b7280; font-size: 12px;">Sent automatically from your UniCal Replit workspace · ${new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })} ET</p>
</div>
`;

(async () => {
  const result = await sendGmail({
    to: 'bryn.kai-hendricks@outlook.com, homeworkbryn@gmail.com',
    subject: 'UniCal Pi Handoff — Step-by-Step Setup Checklist',
    htmlBody: html,
  });
  console.log(result);
  process.exit(result.success ? 0 : 1);
})();
