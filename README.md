# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Switching between local Supabase projects

The frontend can target separate Supabase projects without changing source
code. Create these ignored files in the repository root:

`.env.dev.local`

```dotenv
VITE_SUPABASE_PROJECT_ID="your-dev-project-id"
VITE_SUPABASE_URL="https://your-dev-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-dev-publishable-key"
VITE_PAYMENTS_CLIENT_TOKEN="pk_test_your-dev-stripe-publishable-key"
```

`.env.prod.local`

```dotenv
VITE_SUPABASE_PROJECT_ID="your-prod-project-id"
VITE_SUPABASE_URL="https://your-prod-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-prod-publishable-key"
VITE_PAYMENTS_CLIENT_TOKEN="pk_live_your-prod-stripe-publishable-key"
```

Start the app against the desired project:

```sh
npm run dev:database:dev
npm run dev:database:prod
```

The development mode must use a Stripe `pk_test_` publishable token and shows
the payment sandbox banner. The production mode must use a Stripe `pk_live_`
publishable token and uses live payment configuration. Restart the Vite server
after changing either environment file so the new values are loaded.

The same modes are available for production builds:

```sh
npm run build:database:dev
npm run build:database:prod
```

Only use a publishable/anon key in `VITE_*` variables. Never put a Supabase
service-role key in these files or in browser code. Keep the database schemas,
auth settings, storage buckets, secrets, and Edge Functions synchronized
separately in both Supabase projects. Switching the frontend URL alone does not
switch a deployed Edge Function or migrate the other project's database.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
