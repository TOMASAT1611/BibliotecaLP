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

## Deploy on Vercel

Conectá este repo desde [Vercel](https://vercel.com/new): el `package.json` está en la **raíz**. **No** pongas Root Directory (dejalo vacío). Si antes lo tenías en `web`, **borrá ese valor** y redeploy. Si ves **404**, probá **Deployments → Redeploy**.

Consultá también la documentación oficial de Next.js sobre [deployment](https://nextjs.org/docs/app/building-your-application/deploying).


### Persistencia (Neon en producción)

Sin variable de entorno, el estado vive en `data/state.json` en disco (útil en desarrollo). En **Vercel**, agregá **`DATABASE_URL`** con la connection string de un proyecto [Neon](https://neon.tech); la app guarda el JSON completo en Postgres (tabla `biblioteca_lp_state`, creada automáticamente si no existe). Opcional: script `neon-init.sql` en la raíz para crear la tabla a mano.


