// eslint-disable-next-line filenames/match-regex
import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import axios from 'axios'
import * as core from '@actions/core'
import { Octokit } from '@octokit/action'
import * as github from '@actions/github'
import { JobInfo } from './interfaces'
import * as logger from './logger'
import {
  createCITelemetryData,
  saveJobInfos,
  sendData,
  WORKFLOW_TELEMETRY_ENDPOINTS
} from './utils'

const PAGE_SIZE = 100

const { pull_request } = github.context.payload
const { workflow, job, repo, runId, sha } = github.context

async function triggerStatCollect(port: number): Promise<void> {
  logger.info('Triggering stat collect ...')
  const response = await axios.post(`http://localhost:${port}/collect`)
  if (logger.isDebugEnabled()) {
    logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`)
  }
}

export async function getJobInfo(octokit: Octokit): Promise<JobInfo> {
  const _getJobInfo = async (): Promise<JobInfo> => {
    for (let page = 0; true; page++) {
      let result
      try {
        result = await octokit.rest.actions.listJobsForWorkflowRun({
          owner: repo.owner,
          repo: repo.repo,
          run_id: runId,
          per_page: PAGE_SIZE,
          page
        })
      } catch (error: any) {
        result = undefined
        /**
         * check whether error is Resource not accessible by integration or not
         * if error status equals to 403 it might be 2 different error RateLimitError or ResourceNotAccessible
         * if error status=403 and x-ratelimit-remaining = 0 error must be RateLimitError other
         * else if status=403 and x-ratelimit-remaining != 0 we assume that error is ResourceNotAccessible
         */
        if (
          error &&
          error.response &&
          error.response.headers &&
          error.status &&
          error.response.headers['x-ratelimit-remaining'] !== '0' &&
          error.status === 403
        ) {
          logger.debug(`Request Error: ${error.status} ${error.message}`)
          return {
            id: undefined,
            name: undefined,
            notAccessible: true
          }
        }
      }
      if (!result) {
        break
      }
      const jobs = result.data.jobs

      // If there are no jobs, stop here
      if (!jobs || !jobs.length) {
        break
      }
      const currentJobs = jobs.filter(
        it =>
          it.status === 'in_progress' &&
          it.runner_name === process.env.RUNNER_NAME
      )
      if (currentJobs && currentJobs.length) {
        return {
          id: currentJobs[0].id,
          name: currentJobs[0].name
        }
      }
      // Since returning job count is less than page size, this means that there are no other jobs.
      // So no need to make another request for the next page.
      if (jobs.length < PAGE_SIZE) {
        break
      }
    }
    return {}
  }
  for (let i = 0; i < 10; i++) {
    const currentJobInfo = await _getJobInfo()
    if (
      currentJobInfo &&
      (currentJobInfo.id || currentJobInfo.notAccessible === true)
    ) {
      return currentJobInfo
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return {}
}

///////////////////////////

export async function start(): Promise<void> {
  logger.info(`Starting stat collector ...`)

  try {
    let statFrequency = 0
    const statFrequencyInput: string = core.getInput('stat_frequency')
    if (statFrequencyInput) {
      const statFrequencyVal: number = parseInt(statFrequencyInput)
      if (Number.isInteger(statFrequencyVal)) {
        statFrequency = statFrequencyVal * 1000
      }
    }

    const child: ChildProcess = spawn(
      process.argv[0],
      [path.join(__dirname, '../scw/index.js')],
      {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          WORKFLOW_TELEMETRY_STAT_FREQ: statFrequency
            ? `${statFrequency}`
            : undefined
        }
      }
    )
    child.unref()

    logger.info(`Started stat collector`)
  } catch (error: any) {
    logger.error('Unable to start stat collector')
    logger.error(error)
  }
}

export async function finish(port: number): Promise<void> {
  logger.info(`Finishing stat collector ...`)

  try {
    // Trigger stat collect, so we will have remaining stats since the latest schedule
    await triggerStatCollect(port)

    logger.info(`Finished stat collector`)
  } catch (error: any) {
    logger.error('Unable to finish stat collector')
    logger.error(error)
  }
}

export async function handleJobInfo(): Promise<JobInfo | null> {
  const octokit: Octokit = new Octokit()

  logger.debug(`Workflow - Job: ${workflow} - ${job}`)

  const commit: string =
    (pull_request && pull_request.head && pull_request.head.sha) || sha
  logger.debug(`Commit: ${commit}`)

  const jobInfo: JobInfo = await getJobInfo(octokit)
  if (!jobInfo) {
    logger.error("Couldn't retrieved jobInfo")
    return null
  }
  logger.debug(`Job info: ${JSON.stringify(jobInfo)}`)
  saveJobInfos(jobInfo)
  return jobInfo
}

export async function sendMetricData(port: number): Promise<void> {
  logger.info(`Send stat collector result ...`)
  try {
    const response = await axios.get(`http://localhost:${port}/metrics`)
    const ciTelemetryData = createCITelemetryData(response.data)
    if (logger.isDebugEnabled()) {
      logger.debug(`Sent stat data: ${JSON.stringify(ciTelemetryData)}`)
    }
    sendData(WORKFLOW_TELEMETRY_ENDPOINTS.METRIC, ciTelemetryData)
  } catch (error: any) {
    logger.error('Unable to send stat collector result')
    logger.error(error)
  }
}
