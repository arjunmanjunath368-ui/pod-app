# Pod — chunk 2: scaffold + auth + create/join

Next.js 14 (App Router) + Supabase + Tailwind. This chunk gets you to:
sign in with a magic link, create a pod (with a shareable invite code),
or join one by code. Home / log / feed land in later chunks.

## 0. Prerequisites
- Node.js 18.17+ installed
- The `pod_schema_v1.sql` already run in your Pod Supabase project's SQL Editor

## 1. Install
Open Command Prompt in this folder and run:

    npm install

## 2. Environment
Copy the example and fill in your NEW Pod project's values
(Supabase -> Project Settings -> API). Do NOT reuse your Nexus project.

    copy .env.local.example .env.local

Then edit `.env.local`:

    NEXT_PUBLIC_SUPABASE_URL=https://your-pod-project.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

## 3. Two Supabase dashboard settings (one-time)
Magic links won't work until these are set.

a) Authentication -> URL Configuration
   - Site URL: http://localhost:3000  (swap to your Vercel URL once deployed)
   - Redirect URLs: add  http://localhost:3000/**  (and your Vercel URL + /**)

b) Authentication -> Email Templates -> "Magic Link"
   Replace the link line so it points at our confirm route. The href should be:

       {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email

   (Leave the rest of the template as-is. This is what lets the tapped link
   verify the session on our side and drop the user into /app.)

## 4. Run

    npm run dev

Open http://localhost:3000 -> you'll land on the login screen.
Enter your email, tap the link in the email, and you're in.

## 5. Deploy (later)
Same as your Nexus flow: push to GitHub, Vercel auto-deploys. Add the two
env vars in the Vercel project settings, and add your Vercel URL to both
Supabase URL-config fields above.

## File map
- `middleware.ts` ............ session refresh + route guarding
- `lib/supabase/*` ........... browser + server Supabase clients
- `app/login` ................ magic-link sign in
- `app/auth/confirm` ......... verifies the link, sets the session
- `app/app` .................. authed area (gate: no pod -> /app/start)
- `app/app/start` ............ create-or-join chooser
- `app/app/start/create` ..... create a pod (calls create_pod RPC)
- `app/app/start/join` ....... join by code (calls join_pod RPC)
