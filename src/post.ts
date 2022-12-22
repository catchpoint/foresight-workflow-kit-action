import * as core from '@actions/core'
import * as statCollector from './statCollector'
import * as processTracer from './processTracer'
import * as logger from './logger'
import { JobInfo } from './interfaces'
import { WORKFLOW_TELEMETRY_SERVER_PORT } from './utils'

async function run(): Promise<void> {
  try {
    const actionStartTime = Math.floor(Date.now() / 1000) * 1000
    logger.info(`Finishing ...`)
    logger.info(`actionStartTime: ${actionStartTime}`)
    const port = parseInt(core.getState(WORKFLOW_TELEMETRY_SERVER_PORT))
    logger.info(`SERVER_PORT: ${port}`)
    // Finish stat collector
    await statCollector.finish(port)
    // Finish process tracer
    await processTracer.finish()

    // Report stat collector
    const jobInfo: JobInfo | null = await statCollector.handleJobInfo()
    if (!jobInfo) {
      return
    }
    await statCollector.sendMetricData(port, actionStartTime)
    // Report process tracer
    await processTracer.report(actionStartTime)

    logger.info(`Finish completed`)
  } catch (error: any) {
    logger.info(`Please sure that your workflow has "actions:read" permission!`)
    logger.error(error.message)
  }
}

run()
