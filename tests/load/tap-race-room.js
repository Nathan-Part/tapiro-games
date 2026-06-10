import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const tapLatency = new Trend('tap_latency_ms', true)
const errors = new Counter('socket_errors')

export const options = {
  scenarios: {
    players: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    tap_latency_ms: ['p(95)<200'],
    socket_errors: ['count<5'],
  },
}

const SERVER_URL = __ENV.SERVER_URL || 'ws://localhost:4000'
const ROOM_CODE = __ENV.ROOM_CODE || 'TEST'

export default function () {
  const url = `${SERVER_URL}/socket.io/?EIO=4&transport=websocket`

  const res = ws.connect(url, {}, (socket) => {
    let joined = false

    socket.on('open', () => {
      socket.send('40')
    })

    socket.on('message', (data) => {
      if (data === '40') {
        socket.send(`42["JOIN_ROOM",{"code":"${ROOM_CODE}","name":"VU-${__VU}"}]`)
        joined = true
      }
      if (data.startsWith('42["ERROR"')) {
        errors.add(1)
        socket.close()
      }
    })

    socket.on('error', () => {
      errors.add(1)
    })

    let tapCount = 0
    const interval = setInterval(() => {
      if (!joined) return
      const before = Date.now()
      socket.send('42["TAP_BATCH",{"count":5}]')
      tapLatency.add(Date.now() - before)
      tapCount++
      if (tapCount > 150) {
        clearInterval(interval)
        socket.close()
      }
    }, 200)

    socket.setTimeout(() => {
      clearInterval(interval)
      socket.close()
    }, 35000)
  })

  check(res, { 'WebSocket connected': (r) => r && r.status === 101 })
  sleep(1)
}
