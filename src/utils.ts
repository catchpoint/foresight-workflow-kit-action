import * as logger from './logger';
import * as core from '@actions/core'
import { CITelemetryData, JobInfo, MetaData, ProcessTelemetryDatum, TelemetryDatum } from './interfaces';
import * as github from '@actions/github';
import axios from 'axios';
import * as path from 'path';

export const WORKFLOW_TELEMETRY_SERVER_PORT = "WORKFLOW_TELEMETRY_SERVER_PORT";

export const WORKFLOW_TELEMETRY_VERSIONS = {
    METRIC: "v1",
    PROCESS: "v1"
};

const WORKFLOW_TELEMETRY_BASE_URL = `${process.env["WORKFLOW_TELEMETRY_BASE_URL"] || "https://api.service.runforesight.com"}`

export const WORKFLOW_TELEMETRY_ENDPOINTS = {
    METRIC: new URL(path.join("api", WORKFLOW_TELEMETRY_VERSIONS.METRIC, "telemetry/metrics"), WORKFLOW_TELEMETRY_BASE_URL).toString(),
    PROCESS: new URL(path.join("api", WORKFLOW_TELEMETRY_VERSIONS.PROCESS, "telemetry/processes"), WORKFLOW_TELEMETRY_BASE_URL).toString()
};

export const JOB_STATES_NAME = {
    FORESIGHT_WORKFLOW_JOB_ID: "FORESIGHT_WORKFLOW_JOB_ID",
    FORESIGHT_WORKFLOW_JOB_NAME: "FORESIGHT_WORKFLOW_JOB_NAME",
    FORESIGHT_WORKFLOW_JOB_RUN_ATTEMPT: "FORESIGHT_WORKFLOW_JOB_RUN_ATTEMPT"
}


export async function setServerPort() {
    var portfinder = require('portfinder');
    portfinder.basePort = 10000;
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    if(!port) {
        process.env["WORKFLOW_TELEMETRY_SERVER_PORT"] = await portfinder.getPortPromise();
    }
    core.saveState(WORKFLOW_TELEMETRY_SERVER_PORT, process.env.WORKFLOW_TELEMETRY_SERVER_PORT);
    logger.info(`Workflow telemetry server port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`);
}


export function saveJobInfos(jobInfo: JobInfo) {
    core.exportVariable(JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_ID, jobInfo.id)
    core.exportVariable(JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_NAME, jobInfo.name)
}

function getJobInfo(): JobInfo {
    const jobInfo: JobInfo = {
        id: parseInt(process.env[JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_ID] || ''),
        name: process.env[JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_NAME],
    }
    return jobInfo
}

function getMetaData(): MetaData {
    const { repo, runId } = github.context
    const jobInfo = getJobInfo();
    const metaData: MetaData = {
        ciProvider: "GITHUB",
        runId: runId,
        repoName: repo.repo,
        repoOwner: repo.owner,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        runnerName: process.env.RUNNER_NAME,
        jobId: jobInfo.id,
        jobName: jobInfo.name,
    }
    return metaData
}

export function createCITelemetryData(telemetryData: ProcessTelemetryDatum): CITelemetryData {
    return {
        metaData: getMetaData(),
        telemetryData: telemetryData
    }
}

export async function sendData (url :string, ciTelemetryData: CITelemetryData)
{
    let apiKey : string = core.getInput("api_key");
    if (apiKey == null) {
      logger.debug(`api key is null`);
      return;
    }
    logger.debug(`Sending data (api key=${core.getInput("api_key")}) to url: ${url}`);
    try {
        const { data } = await axios.post(
          url,
          ciTelemetryData,
          {
            headers: {
              'Content-type': 'application/json; charset=utf-8',
              'Authorization': `ApiKey ${core.getInput("api_key")}`
            },
          },
        );
    
        if (logger.isDebugEnabled()) {
          logger.debug(JSON.stringify(data, null, 4));
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          logger.error(error.message);
        } else {
          logger.error(`unexpected error: ${error}`)
        }
      }
}
