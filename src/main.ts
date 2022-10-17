import * as statCollector from './statCollector'
import * as processTracer from './processTracer'
import * as logger from './logger'
import { setServerPort } from './utils'

async function run(): Promise<void> {
  try {
    logger.info(`Initializing ...`)
    await setServerPort()
    // Start stat collector
    await statCollector.start()
    // Start process tracer
    await processTracer.start()

    logger.info(`Initialization completed`)
  } catch (error: any) {
    logger.error(error.message)
  }
}

run()
