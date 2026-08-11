# Atlas 2.0 Foundation

## Логіка пошуку Atlas 2.4

1. Atlas розкладає задачу на 1–4 необхідні ланки.
2. Кожна ланка спочатку шукається у реальних Паспортах можливостей.
3. Після перевірки Паспортів користувач сам обирає зовнішній пошук: `Поруч`, `В інтернеті` або `Поруч + інтернет`.
4. Atlas показує не загальний список, а один або два послідовні ланцюжки рішення.
5. Якщо перевіреного результату немає, ланка залишається порожньою — вигадані люди, компанії, ціни та посилання не створюються.

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
