export interface JobInfo {
    readonly id?: number | undefined
    readonly name?: string | undefined
}

export interface MetaData {
    readonly ciProvider: string
    readonly runId: number
    readonly repoName: string
    readonly repoOwner: string
    readonly runAttempt: string | undefined
    readonly runnerName: string | undefined
    readonly jobId?: number | undefined
    readonly jobName?: string | undefined
}

export interface CITelemetryData {
    readonly metaData: MetaData;
    readonly telemetryData: TelemetryDatum
}
 
export interface TelemetryDatum {
    readonly version: string
    readonly type: string
}

export interface MetricTelemetryDatum extends TelemetryDatum {
    readonly data: MetricStats[]
}


export interface ProcessTelemetryDatum extends TelemetryDatum {
    readonly data: CompletedCommand[]
}

export interface MetricStats {
    readonly domain: string
    readonly group: string
    readonly time: number
    readonly points: Point[] | undefined
}

export interface Point {
    readonly name: string
    readonly value: Object
}

export interface CompletedCommand {
    readonly ts: string,
    readonly event: string,
    readonly name: string,
    readonly uid: number,
    readonly pid: number,
    readonly ppid: string,
    readonly startTime: number,
    readonly fileName: string,
    readonly args: string[],
    readonly duration: number,
    readonly exitCode: number
}

export interface ProcEventParseOptions {
    readonly minDuration: number,
    readonly traceSystemProcesses: boolean
}
