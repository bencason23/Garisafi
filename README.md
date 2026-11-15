# GariSafi.com

GariSafi.com is a car and spare-parts marketplace served by an Express application. Accounts, sessions, vehicle details, and spare-part listings are stored in MongoDB; on Vercel, listing photos are stored in Vercel Blob.

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

The first successful start inserts the three example vehicles into MongoDB if they are not already present. Car and spare-part listings are saved to MongoDB and returned by `GET /api/cars` and `GET /api/parts`; in local development, listing photos are stored in MongoDB. Posting either type of listing requires an account. New accounts require an international-format phone number. Spare-part browsing is on `parts.html` and posting is on the separate `sell-part.html` page, linked from the hamburger menu; if sign-in is required, users return to the spare-part form afterward. Spare-part sellers can upload up to 10 JPG, PNG, or WebP photos (5 MB each, 12 MB total) and provide an international phone number; buyers can view the photos in the part detail page gallery, reveal the seller's phone number, or start a GariSafi chat, which opens the conversation in the inbox. Sellers do not see buyer contact or chat actions on their own listings. Car sellers provide a description, an international phone number, and at least five photos (up to 10 photos, 5 MB each, and 12 MB total); buyers can open a car card for its gallery and details, then call, email, WhatsApp, or message the seller inside GariSafi. In-site car and spare-part conversations and messages are stored in MongoDB and can be viewed by their participants and authorized administrators. Buyers and sellers can open the Messages item in the hamburger menu to read and reply; messages refresh every five seconds. Login, listing, and messaging feedback appears as animated, dismissible toast notifications. Registration hashes passwords with bcrypt; login sessions are stored in MongoDB and use an HTTP-only cookie.

The admin dashboard at `admin.html` is a separate, server-protected workspace connected to MongoDB. Its member, car, spare-part, and conversation pages search across the database and paginate through every matching record; conversation details include paginated message history. Administrators can block or unblock a member's site access, or remove their account while keeping their listings and conversation history (account references are detached). Administrators can also remove car and spare-part listings. Dashboard totals include members, listings, conversations, and messages. The overview includes ranked car and spare-part searches for the selected period, based on searches submitted on the marketplace; analytics starts collecting after this feature is enabled and does not backfill older searches.

Do not commit `.env` or expose database credentials. Production deployments should use HTTPS and a strong, private session secret.

## Deploy with GitHub and Vercel

The Express API runs as a Vercel Node.js Function through `api/[...path].js`; MongoDB stores application data and sessions. Listing photos upload directly from the browser to Vercel Blob, so large multi-photo requests do not pass through the function body-size limit.

1. Push this project to GitHub and import that repository into Vercel. Use the repository root as the project root. Vercel runs `npm run build:vercel`, which builds the Blob browser uploader and puts the public pages in `dist`.
2. In MongoDB Atlas, create a production database and allow connections from Vercel. Set `MONGODB_URI`, `SESSION_SECRET` (a unique random value of at least 32 characters), and `ADMIN_EMAIL` in the Vercel project’s Production environment variables.
3. In the Vercel project’s **Storage** section, create a **public** Blob store and connect it to the project’s Production environment. Ensure `BLOB_READ_WRITE_TOKEN` is available to the deployment.
4. Deploy or redeploy the project after setting the environment variables. Register using an address in `ADMIN_EMAIL` to access the protected `admin.html` dashboard.
5. Test the deployed health endpoint at `/api/health`; it should return `"status":"ok"` and `"blobUploadsEnabled":true`. Then test registration, login, listings, image uploads, messaging, and admin access.

The Vercel Blob browser upload flow requires a signed upload token, and the API only issues one to a signed-in user for their own listing photos. Old MongoDB-stored photos continue to work. For local development, keep using `npm.cmd start` and configure `.env`; Blob uploads are optional and multipart uploads continue to work locally.
