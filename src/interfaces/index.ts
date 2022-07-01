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
    readonly telemetryData: TelemetryDatum[]
}
 
export interface TelemetryDatum {
    readonly version: string
    readonly data: Object
    readonly type: string
}

export interface MetricStats {
    readonly time: number
    readonly metricName: string
}

export interface CPUStats extends MetricStats {
    readonly totalLoad: number
    readonly userLoad: number
    readonly systemLoad: number
}

export interface MemoryStats extends MetricStats {
    readonly totalMemoryMb: number
    readonly activeMemoryMb: number
    readonly availableMemoryMb: number
}

export interface NetworkStats extends MetricStats {
    readonly rxMb: number
    readonly txMb: number
}

export interface DiskStats extends MetricStats {
    readonly time: number
    readonly rxMb: number
    readonly wxMb: number
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
