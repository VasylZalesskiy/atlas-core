# Atlas 2.0 Foundation

## Запуск
```powershell
npm install
npm run dev
```

## Новий GitHub-репозиторій
Створіть порожній репозиторій `atlas-core`, потім:

```powershell
git init
git add .
git commit -m "Atlas 2.0 Foundation"
git branch -M main
git remote add origin https://github.com/VasylZalesskiy/atlas-core.git
git push -u origin main
```

## Vercel
Імпортуйте `atlas-core` та додайте:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
