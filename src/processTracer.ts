import { ChildProcess, spawn, exec } from 'child_process'
import path from 'path'
import * as core from '@actions/core'
import si from 'systeminformation'
import { parse } from './procTraceParser'
import { CompletedCommand, ProcessTelemetryDatum } from './interfaces'
import * as logger from './logger'
import {
  createCITelemetryData,
  sendData,
  WORKFLOW_TELEMETRY_ENDPOINTS,
  WORKFLOW_TELEMETRY_VERSIONS
} from './utils'

const PROC_TRACER_PID_KEY: string = 'PROC_TRACER_PID'
const PROC_TRACER_OUTPUT_FILE_NAME: string = 'proc-trace.out'
const PROC_TRACER_BINARY_NAME_UBUNTU_20: string = 'proc-tracer_ubuntu_20'

let finished: boolean = false

async function getProcessTracerBinaryName(): Promise<string | null> {
  const osInfo: si.Systeminformation.OsData = await si.osInfo()
  if (osInfo) {
    // Check whether we are running on Ubuntu
    if (osInfo.distro === 'Ubuntu') {
      const majorVersion: number = parseInt(osInfo.release.split('.')[0])
      if (majorVersion === 20) {
        return PROC_TRACER_BINARY_NAME_UBUNTU_20
      }
    }
  }

  logger.info(
    `Process tracing disabled because of unsupported OS: ${JSON.stringify(
      osInfo
    )}`
  )

  return null
}

///////////////////////////

export async function start(): Promise<void> {
  logger.info(`Starting process tracer ...`)

  try {
    const procTracerBinaryName: string | null =
      await getProcessTracerBinaryName()
    if (procTracerBinaryName) {
      const procTraceOutFilePath = path.join(
        __dirname,
        '../proc-tracer',
        PROC_TRACER_OUTPUT_FILE_NAME
      )
      const child: ChildProcess = spawn(
        'sudo',
        [
          path.join(__dirname, `../proc-tracer/${procTracerBinaryName}`),
          '-f',
          'json',
          '-o',
          procTraceOutFilePath
        ],
        {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env
          }
        }
      )
      child.unref()

      core.saveState(PROC_TRACER_PID_KEY, child.pid?.toString())

      logger.info(`Started process tracer`)
    }
  } catch (error: any) {
    logger.error('Unable to start process tracer')
    logger.error(error)
  }
}

export async function finish(): Promise<void> {
  logger.info(`Finishing process tracer ...`)

  const procTracePID: string = core.getState(PROC_TRACER_PID_KEY)
  if (!procTracePID) {
    logger.info(
      `Skipped finishing process tracer since process tracer didn't started`
    )
    return
  }
  try {
    logger.debug(
      `Interrupting process tracer with pid ${procTracePID} to stop gracefully ...`
    )

    await exec(`sudo kill -s INT ${procTracePID}`)
    finished = true

    logger.info(`Finished process tracer`)
  } catch (error: any) {
    logger.error('Unable to finish process tracer')
    logger.error(error)
  }
}

export async function report(): Promise<void> {
  logger.info(`Reporting process tracer result ...`)

  if (!finished) {
    logger.info(
      `Skipped reporting process tracer since process tracer didn't finished`
    )
    return
  }
  try {
    const procTraceOutFilePath = path.join(
      __dirname,
      '../proc-tracer',
      PROC_TRACER_OUTPUT_FILE_NAME
    )

    logger.info(
      `Getting process tracer result from file ${procTraceOutFilePath} ...`
    )

    let minProcDuration: number = -1
    const minProcDurationInput: string = core.getInput('min_proc_duration')
    if (minProcDurationInput) {
      const minProcDurationVal: number = parseInt(minProcDurationInput)
      if (Number.isInteger(minProcDurationVal)) {
        minProcDuration = minProcDurationVal
      }
    }

    const traceSysProcs: boolean = core.getInput('trace_sys_procs') === 'true'

    const completedCommands: CompletedCommand[] = await parse(
      procTraceOutFilePath,
      {
        minDuration: minProcDuration,
        traceSystemProcesses: traceSysProcs
      }
    )

    const processInfos: ProcessTelemetryDatum = {
      type: 'Process',
      version: WORKFLOW_TELEMETRY_VERSIONS.PROCESS,
      data: completedCommands
    }

    await sendProcessData(processInfos)

    logger.info(`Reported process tracer result`)
  } catch (error: any) {
    logger.error('Unable to report process tracer result')
    logger.error(error)
  }
}

async function sendProcessData(
  processInfos: ProcessTelemetryDatum
): Promise<void> {
  logger.info(`Send process result ...`)
  try {
    const ciTelemetryData = createCITelemetryData(processInfos)
    if (logger.isDebugEnabled()) {
      logger.debug(`Sent process data: ${JSON.stringify(ciTelemetryData)}`)
    }
    sendData(WORKFLOW_TELEMETRY_ENDPOINTS.PROCESS, ciTelemetryData)
  } catch (error: any) {
    logger.error('Unable to send process result')
    logger.error(error)
  }
}
