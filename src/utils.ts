import * as logger from './logger'
import * as core from '@actions/core'
import {
  ApiKeyInfo,
  CITelemetryData,
  JobInfo,
  MetaData,
  OnDemandAPIKeyParam,
  ProcessTelemetryDatum
} from './interfaces'
import * as github from '@actions/github'
import axios from 'axios'
import * as path from 'path'

export const WORKFLOW_TELEMETRY_SERVER_PORT = 'WORKFLOW_TELEMETRY_SERVER_PORT'

export const WORKFLOW_TELEMETRY_VERSIONS = {
  METRIC: 'v1',
  PROCESS: 'v1'
}

const WORKFLOW_TELEMETRY_BASE_URL = `${
  process.env['WORKFLOW_TELEMETRY_BASE_URL'] ||
  'https://api.service.runforesight.com'
}`

export const WORKFLOW_TELEMETRY_ENDPOINTS = {
  METRIC: new URL(
    path.join('api', WORKFLOW_TELEMETRY_VERSIONS.METRIC, 'telemetry/metrics'),
    WORKFLOW_TELEMETRY_BASE_URL
  ).toString(),
  PROCESS: new URL(
    path.join(
      'api',
      WORKFLOW_TELEMETRY_VERSIONS.PROCESS,
      'telemetry/processes'
    ),
    WORKFLOW_TELEMETRY_BASE_URL
  ).toString()
}

const ON_DEMAND_API_KEY_BASE_URL = `${
  process.env['ON_DEMAND_API_KEY_BASE_URL'] ||
  'https://api-public.service.runforesight.com'
}`
export const ON_DEMAND_API_KEY_ENDPOINT = new URL(
  path.join('api', 'v1/apikey/ondemand'),
  ON_DEMAND_API_KEY_BASE_URL
).toString()

export const JOB_STATES_NAME = {
  FORESIGHT_WORKFLOW_JOB_ID: 'FORESIGHT_WORKFLOW_JOB_ID',
  FORESIGHT_WORKFLOW_JOB_NAME: 'FORESIGHT_WORKFLOW_JOB_NAME',
  FORESIGHT_WORKFLOW_JOB_RUN_ATTEMPT: 'FORESIGHT_WORKFLOW_JOB_RUN_ATTEMPT'
}

export async function setServerPort() {
  var portfinder = require('portfinder')
  portfinder.basePort = 10000
  const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '')
  if (!port) {
    process.env['WORKFLOW_TELEMETRY_SERVER_PORT'] =
      await portfinder.getPortPromise()
  }
  core.saveState(
    WORKFLOW_TELEMETRY_SERVER_PORT,
    process.env.WORKFLOW_TELEMETRY_SERVER_PORT
  )
  logger.info(
    `Workflow telemetry server port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`
  )
}

export function saveJobInfos(jobInfo: JobInfo) {
  core.exportVariable(JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_ID, jobInfo.id)
  core.exportVariable(JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_NAME, jobInfo.name)
}

function getJobInfo(): JobInfo {
  const jobInfo: JobInfo = {
    id: parseInt(process.env[JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_ID] || ''),
    name: process.env[JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_NAME]
  }
  return jobInfo
}

function getMetaData(executionTime: number): MetaData {
  const { repo, runId } = github.context
  const jobInfo = getJobInfo()
  const metaData: MetaData = {
    ciProvider: 'GITHUB',
    runId,
    repoName: repo.repo,
    repoOwner: repo.owner,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    runnerName: process.env.RUNNER_NAME,
    jobId: jobInfo.id,
    jobName: jobInfo.name,
    executionTime
  }
  return metaData
}

export function createCITelemetryData(
  telemetryData: ProcessTelemetryDatum,
  executionTime: number
): CITelemetryData {
  return {
    metaData: getMetaData(executionTime),
    telemetryData
  }
}

export async function sendData(url: string, ciTelemetryData: CITelemetryData) {
  const apiKeyInfo = await getApiKey()
  if (apiKeyInfo == null || apiKeyInfo.apiKey == null) {
    logger.error(`ApiKey is not exists! Data can not be send.`)
    return
  }
  logger.debug(`Sending data (api key=${apiKeyInfo.apiKey}) to url: ${url}`)
  try {
    const { data } = await axios.post(url, ciTelemetryData, {
      headers: {
        'Content-type': 'application/json; charset=utf-8',
        Authorization: `ApiKey ${apiKeyInfo.apiKey}`
      }
    })

    if (logger.isDebugEnabled()) {
      logger.debug(JSON.stringify(data, null, 4))
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(error.message)
    } else {
      logger.error(`unexpected error: ${error}`)
    }
  }
}

async function getApiKey(): Promise<ApiKeyInfo | null> {
  const apiKey: string = core.getInput('api_key')
  if (apiKey) {
    logger.debug(`ApiKey: ${apiKey}`)
    return { apiKey }
  } else {
    logger.debug(`ApiKey is not defined! Requesting on demand ApiKey`)
    const { repo, runId } = github.context
    const onDemandAPIKeyParam: OnDemandAPIKeyParam = {
      repoFullName: `${repo.owner}/${repo.repo}`,
      workflowRunId: runId
    }
    logger.debug(
      `On demand api key request params: ${JSON.stringify(
        onDemandAPIKeyParam,
        null,
        4
      )} `
    )
    const onDemandApiKey = await getOnDemandApiKey(onDemandAPIKeyParam)
    return onDemandApiKey != null ? onDemandApiKey : null
  }
}

async function getOnDemandApiKey(
  onDemandAPIKey: OnDemandAPIKeyParam
): Promise<ApiKeyInfo | null> {
  logger.debug(`Getting on demand api key from: ${ON_DEMAND_API_KEY_ENDPOINT}`)
  try {
    const { data } = await axios.post(
      ON_DEMAND_API_KEY_ENDPOINT,
      onDemandAPIKey,
      {
        headers: {
          'Content-type': 'application/json; charset=utf-8'
        }
      }
    )
    logger.debug(`Data: ${data}`)
    return data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(error.message)
    } else {
      logger.error(`unexpected error: ${error}`)
    }
    return null
  }
}
