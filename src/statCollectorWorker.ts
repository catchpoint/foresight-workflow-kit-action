import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import si from 'systeminformation'
import * as logger from './logger'
import {
  MetricStats,
  Point,
  MetricTelemetryDatum,
} from './interfaces'
import { WORKFLOW_TELEMETRY_VERSIONS } from './utils'

const STATS_FREQ: number =
  parseInt(process.env.WORKFLOW_TELEMETRY_STAT_FREQ || '') || 5000
const SERVER_HOST: string = 'localhost'
const SERVER_PORT: number = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');

let expectedScheduleTime: number = 0
let statCollectTime: number = 0

const metricStatsData: MetricStats[] = []

const metricTelemetryData: MetricTelemetryDatum = {
  "type": "Metric",
  "version": WORKFLOW_TELEMETRY_VERSIONS.METRIC,
  "data": metricStatsData
}

///////////////////////////

// CPU Stats             //
///////////////////////////

function collectCPUStats(
    statTime: number,
    timeInterval: number
): Promise<any> {
  return si
      .currentLoad()
      .then((data: si.Systeminformation.CurrentLoadData) => {
        const points: Point[] = [
          {
            unit: "Percentage",
            description: "CPU Load Total",
            name: "cpu.load.total",
            value: (data.currentLoad && data.currentLoad > 0 ? data.currentLoad : 0)
          },
          {
            unit: "Percentage",
            description: "CPU Load User",
            name: "cpu.load.user",
            value:(data.currentLoadUser && data.currentLoadUser  > 0 ? data.currentLoadUser : 0)
          },
          {
            unit: "Percentage",
            description: "CPU Load System",
            name: "cpu.load.system",
            value: (data.currentLoadSystem && data.currentLoadSystem > 0 ? data.currentLoadSystem : 0)
          }
        ]
        const cpuStats: MetricStats = {
          domain: "cpu",
          group: "cpu.load",
          time: statTime,
          points: points
        }
        metricTelemetryData.data.push(cpuStats)
      })
      .catch((error: any) => {
        logger.error(error)
      })
}

///////////////////////////

// Memory Stats          //
///////////////////////////

function collectMemoryStats(
    statTime: number,
    timeInterval: number
): Promise<any> {
  return si
      .mem()
      .then((data: si.Systeminformation.MemData) => {
        const points: Point[] = [
          {
            unit: "Mb",
            description: "Memory Usage Total",
            name: "memory.usage.total",
            value: (data.total && data.total > 0 ? data.total : 0) / 1024 / 1024
          },
          {
            unit: "Mb",
            description: "Memory Usage Active",
            name: "memory.usage.active",
            value: (data.active && data.active > 0 ? data.active : 0) / 1024 / 1024
          },
          {
            unit: "Mb",
            description: "Memory Usage Available",
            name: "memory.usage.available",
            value: (data.available && data.available > 0 ? data.available : 0) / 1024 / 1024
          }
        ]
        const memoryStats: MetricStats = {
          domain: "memory",
          group: "memory.usage",
          time: statTime,
          points: points
        }
        metricTelemetryData.data.push(memoryStats)
      })
      .catch((error: any) => {
        logger.error(error)
      })
}

///////////////////////////

// Network Stats         //
///////////////////////////

function collectNetworkStats(
  statTime: number,
  timeInterval: number
): Promise<any> {
  return si
    .networkStats()
    .then((data: si.Systeminformation.NetworkStatsData[]) => {
      let totalRxSec = 0,
        totalTxSec = 0
      for (let nsd of data) {
        totalRxSec += nsd.rx_sec && nsd.rx_sec > 0 ? nsd.rx_sec : 0
        totalTxSec += nsd.tx_sec && nsd.tx_sec > 0 ? nsd.tx_sec : 0
      }
      const points: Point[] = [
        {
          unit: "Mb",
          description: "Network IO Receive",
          name: "network.io.rxMb",
          value: Math.floor((totalRxSec * (timeInterval / 1000)) / 1024 / 1024)
        },
        {
          unit: "Mb",
          description: "Network IO Transmit",
          name: "network.io.txMb",
          value: Math.floor((totalTxSec * (timeInterval / 1000)) / 1024 / 1024)
        }
      ]
      const networkStats: MetricStats = {
        domain: "network",
        group: "network.io",
        time: statTime,
        points: points
      }
      metricTelemetryData.data.push(networkStats)
    })
    .catch((error: any) => {
      logger.error(error)
    })
}

///////////////////////////

// Disk Stats            //
///////////////////////////

function collectDiskStats(
  statTime: number,
  timeInterval: number
): Promise<any> {
  return si
    .fsStats()
    .then((data: si.Systeminformation.FsStatsData) => {
      let rxSec = data.rx_sec && data.rx_sec > 0 ? data.rx_sec : 0
      let wxSec = data.wx_sec && data.wx_sec > 0 ? data.wx_sec : 0 

      const points: Point[] = [
        {
          unit: "Mb",
          description: "Disk IO Read",
          name: "disk.io.rxMb",
          value: Math.floor((rxSec * (timeInterval / 1000)) / 1024 / 1024)
        },
        {
          unit: "Mb",
          description: "Disk IO Write",
          name: "disk.io.wxMb",
          value: Math.floor((wxSec * (timeInterval / 1000)) / 1024 / 1024)
        }
      ]
      const diskStats: MetricStats = {
        domain: "disk",
        group: "disk.io",
        time: statTime,
        points: points
      }
      metricTelemetryData.data.push(diskStats)
    })
    .catch((error: any) => {
      logger.error(error)
    })
}

///////////////////////////

async function collectStats(triggeredFromScheduler: boolean = true) {
  try {
    const currentTime: number = Date.now()
    const timeInterval: number = statCollectTime
      ? currentTime - statCollectTime
      : 0

    statCollectTime = currentTime

    const promises: Promise<any>[] = []

    promises.push(collectCPUStats(statCollectTime, timeInterval))
    promises.push(collectMemoryStats(statCollectTime, timeInterval))
    promises.push(collectNetworkStats(statCollectTime, timeInterval))
    promises.push(collectDiskStats(statCollectTime, timeInterval))

    return promises
  } finally {
    if (triggeredFromScheduler) {
      expectedScheduleTime += STATS_FREQ
      setTimeout(collectStats, expectedScheduleTime - Date.now())
    }
  }
}

function startHttpServer() {
  const server: Server = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      try {
        switch (request.url) {
          case '/collect': {
            if (request.method === 'POST') {
              await collectStats(false)
              response.end()
            } else {
              response.statusCode = 405
              response.end()
            }
            break
          }
          case '/metrics': {
            if (request.method === 'GET') {
              response.end(JSON.stringify(metricTelemetryData))
            } else {
              response.statusCode = 405
              response.end()
            }
            break;
          }
          default: {
            response.statusCode = 404
            response.end()
          }
        }
      } catch (error: any) {
        logger.error(error)
        response.statusCode = 500
        response.end(
          JSON.stringify({
            type: error.type,
            message: error.message
          })
        )
      }
    }
  )

  server.listen(SERVER_PORT, SERVER_HOST, () => {
    logger.info(`Stat server listening on port ${SERVER_PORT}`)
  })
}

// Init                  //
///////////////////////////

function init() {
  expectedScheduleTime = Date.now()

  logger.info('Starting stat collector ...')
  process.nextTick(collectStats)

  logger.info('Starting HTTP server ...')
  startHttpServer()
}

init()

///////////////////////////
