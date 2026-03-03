This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Whop configuration

This project requires a Whop company API key and your company ID in order to create embedded checkout configurations.

- `WHOP_API_KEY` **must be kept secret** and only available on the server.
- `WHOP_COMPANY_ID` is also used by the server. You may expose it to the browser via a `NEXT_PUBLIC_` prefixed variable _if_ you need the ID client‑side, but the server-side code uses the unprefixed version.

Add the following variables to your environment (`.env.local` in development):

```env
WHOP_API_KEY=apik_...
WHOP_COMPANY_ID=biz_...
# (optional) NEXT_PUBLIC_WHOP_COMPANY_ID=biz_... if you need the ID on the client
```

Ensure you restart the dev server after editing `.env.local` so the new values are picked up.

You can obtain these values from your Whop dashboard under **Settings → API**.


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
