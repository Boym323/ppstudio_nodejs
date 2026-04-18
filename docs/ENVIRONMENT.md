# Environment Variables

Dokumentace proměnných prostředí pro lokální vývoj i produkci.

## Pravidla
- Tajné hodnoty nikdy neukládej do repozitáře.
- Každá nová proměnná musí mít popis a příklad v `.env.example`.

## Přehled
- `NODE_ENV`: režim běhu (`development`, `production`).
- `NEXT_PUBLIC_APP_URL`: veřejná URL aplikace.
- `API_BASE_URL`: URL backend API.
- `API_TOKEN`: serverový token pro komunikaci s API.
