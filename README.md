# GariSafi.com

GariSafi.com is a car and spare-parts marketplace served by an Express application. Accounts, sessions, vehicle details, spare-part listings, and seller-uploaded photos are stored in MongoDB.

## Run locally

1. Install Node.js and start a MongoDB server, or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your database connection string. Replace `SESSION_SECRET` with a unique random value of at least 32 characters. For example, generate one with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   To enable the separate admin dashboard, set `ADMIN_EMAIL` to the email address of the account that should administer the marketplace. Multiple administrator emails can be separated by commas. Register an account using one of those addresses, then sign in at `http://localhost:3000/admin.html`. Admin access is checked on the server for dashboard data and listing-management actions.

4. Install dependencies and start the site from this folder:

   ```sh
   npm.cmd install
   npm.cmd start
   ```

5. Open `http://localhost:3000`.

The first successful start inserts the three example vehicles into MongoDB if they are not already present. Car listings and spare-part listings, including their image data, are saved to MongoDB and returned by `GET /api/cars` and `GET /api/parts`. Posting either type of listing requires an account. New accounts require an international-format phone number. Spare-part browsing is on `parts.html` and posting is on the separate `sell-part.html` page, linked from the hamburger menu; if sign-in is required, users return to the spare-part form afterward. Spare-part sellers can upload up to 10 JPG, PNG, or WebP photos (5 MB each, 12 MB total) and provide an international phone number; buyers can view the photos in the part detail page gallery, reveal the seller's phone number, or start a GariSafi chat, which opens the conversation in the inbox. Sellers do not see buyer contact or chat actions on their own listings. Car sellers provide a description, an international phone number, and at least five photos (up to 10 photos, 5 MB each, and 12 MB total); buyers can open a car card for its gallery and details, then call, email, WhatsApp, or message the seller inside GariSafi. In-site car and spare-part conversations and messages are stored in MongoDB and can be viewed by their participants and authorized administrators. Buyers and sellers can open the Messages item in the hamburger menu to read and reply; messages refresh every five seconds. Login, listing, and messaging feedback appears as animated, dismissible toast notifications. Registration hashes passwords with bcrypt; login sessions are stored in MongoDB and use an HTTP-only cookie.

The admin dashboard at `admin.html` is a separate, server-protected workspace connected to MongoDB. Its member, car, spare-part, and conversation pages search across the database and paginate through every matching record; conversation details include paginated message history. Administrators can block or unblock a member's site access, or remove their account while keeping their listings and conversation history (account references are detached). Administrators can also remove car and spare-part listings. Dashboard totals include members, listings, conversations, and messages. The overview includes ranked car and spare-part searches for the selected period, based on searches submitted on the marketplace; analytics starts collecting after this feature is enabled and does not backfill older searches.

Do not commit `.env` or expose database credentials. Production deployments should use HTTPS and a strong, private session secret.

## Deploy with GitHub, Vercel, and Render

This project keeps the Express/MongoDB API on a Node.js host so multi-photo uploads are not constrained by Vercel Function request limits. The Vercel site proxies `/api/*` to Render, so browser API requests and session cookies remain on the Vercel site origin.

1. Install Git, create a GitHub repository, and push this project. `.env`, `node_modules`, and generated deployment output are excluded by `.gitignore`; never commit database credentials.
2. In MongoDB Atlas, create a production database and allow connections from Render. Copy its connection string for the Render environment; do not put it in the repository.
3. In Render, create a web service from the GitHub repository using `render.yaml`. Set `MONGODB_URI`, `ADMIN_EMAIL`, and `FRONTEND_ORIGINS` in the service environment. Set `FRONTEND_ORIGINS` to the exact Vercel site origin (for example `https://your-project.vercel.app`; comma-separate any additional trusted production origins). Render generates `SESSION_SECRET` from the blueprint. Keep `NODE_ENV=production`.
4. In `vercel.json`, replace `REPLACE_WITH_RENDER_SERVICE` in the API rewrite destination with the Render service hostname. Import the same GitHub repository into Vercel and deploy with the project root as the root directory. The `build:vercel` script creates a `dist` folder containing only the public site files.
5. After Vercel assigns the site URL, make sure that exact origin is in Render's `FRONTEND_ORIGINS`, save the environment, and redeploy the Render service. Test registration/login, listings, messages, image uploads, and admin access on the deployed site.

For local development, `FRONTEND_ORIGINS` can remain unset; same-origin requests are allowed. The Render free tier may sleep when idle, so the first request after inactivity can take longer.
