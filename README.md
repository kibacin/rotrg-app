# ROTRG Taxi PWA

Next.js/Supabase aplikacija za vozače i administratore voznog parka.

## Funkcije

- sedmični raspored sa rokom 16:30 za sutrašnji dan;
- redovna i Bled dodjela vozila sa push obavijestima;
- računi goriva i gotovinskih vožnji;
- kamera izvještaji vozila sa obaveznih 6–8 slika;
- najave sa slikama i automatskim istekom;
- upravljanje vozačima;
- vozila i servisna historija;
- grupni chat sa `@` tagovanjem;
- postavke pristupačnosti i instalabilni PWA.

## Lokalni razvoj

Kopiraj `.env.example` u `.env.local`, popuni vrijednosti i pokreni:

```bash
npm install
npm run dev
```

Provjera produkcijske verzije:

```bash
npm run lint
npm run build
```

Kompletan redoslijed Supabase migracije, automatskog brisanja i Vercel deploya
nalazi se u `DEPLOY-NEW-FEATURES.md`.
