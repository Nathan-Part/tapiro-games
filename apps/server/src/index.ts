import { createApp } from './createApp'

try { process.loadEnvFile() } catch {}

// Filet de sécurité : une exception isolée ne doit pas couper tout le serveur
// (toutes les rooms). Les causes sont corrigées à la source (validation), ceci
// évite qu'un cas oublié soit fatal. À coupler avec un superviseur (systemd/pm2).
process.on('uncaughtException', (err) => console.error('[fatal] uncaughtException', err))
process.on('unhandledRejection', (err) => console.error('[fatal] unhandledRejection', err))

const { httpServer } = createApp()
const PORT = Number(process.env.PORT ?? 4000)

httpServer.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`)
})
