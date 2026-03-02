# ponto-seguranca-app
Sistema de ponto eletrônico com selfie e geolocalização para seguranças.

## Variáveis de ambiente
Defina no `.env.local` e na Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SELFIE_BUCKET=selfies-ponto`
- `CRON_SECRET` (segredo para proteger jobs internos)
- `SELFIE_RETENTION_DAYS=60` (opcional; padrão 60)

## Retenção de selfies (LGPD)
O projeto possui job automático de retenção:

- Rota: `POST /api/jobs/cleanup-selfies`
- Segurança: requer header `Authorization: Bearer <CRON_SECRET>`
- Ação: remove arquivos antigos do bucket e limpa `pontos.selfie_url`
- Critério: `created_at` mais antigo que `SELFIE_RETENTION_DAYS`

Agendamento mensal (Vercel Cron) em `vercel.json`:

- `0 3 1 * *` (dia 1, 03:00 UTC)

### Teste manual do job
```bash
curl -X POST http://localhost:3000/api/jobs/cleanup-selfies \
  -H "Authorization: Bearer $CRON_SECRET"
```
