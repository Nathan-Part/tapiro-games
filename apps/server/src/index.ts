import { createApp } from './createApp'

const { httpServer } = createApp()
const PORT = Number(process.env.PORT ?? 4000)

httpServer.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`)
})
