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

## AI generation provider

ProofUI uses the deterministic mock provider by default. To enable a real
OpenAI-compatible Qwen endpoint, copy `.env.example` to `.env.local` and set:

```bash
AI_PROVIDER=qwen
AI_BASE_URL=https://your-gateway.example/v1
AI_MODEL=your-qwen-model
AI_API_KEY=your-rotated-server-side-key
```

For Google Gemini, use this alternative configuration:

```bash
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-flash-latest
GEMINI_API_KEY=your-rotated-server-side-key
```

Restart the development server after changing environment variables. Keep the
API key server-side: never prefix it with `NEXT_PUBLIC_`, commit it, paste it
into browser code, or expose it through an API response. If a key has appeared
in chat or source control, revoke it before use.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
