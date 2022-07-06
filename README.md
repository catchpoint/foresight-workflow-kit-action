# foresight-workflow-kit-action

A GitHub Action to track and monitor the resource metrics of your GitHub Action workflow runs. If the run is triggered via a Pull Request, it will create a comment on the connected PR with the results and/or publishes the results to the job summary. The action collects the following metrics:

- CPU Load (user and system) in percentage
- Memory usage (used and free) in MB
- Network I/O (receive and transmit) in MB
- Disk I/O (read and write) in MB

## Usage

To use the action, add the following step before the steps you want to track.

```yaml
- name: Collect Workflow Telemetry
  uses: runforesight/foresight-workflow-kit-action@v1
  with:
    api_key: <foresight_api_key>
```

## Configuration

| Option                | Requirement       | Description
| ---                   | ---               | ---
| `api_key`        | Required          |  Foresight Api Key.
| `github_token`        | Optional          | An alternative GitHub token, other than the default provided by GitHub Actions runner.
| `min_proc_duration`      | Optional          | Minimum duration value in milliseconds to trace processes. Must be a number. Defaults to '-1' (no min value).
| `trace_sys_procs`      | Optional          | Enables tracing default system processes ('aws', 'cat', 'sed', ...). Defaults to 'false'.
| `stat_frequency`      | Optional          | Statistic collection frequency in seconds. Must be a number. Defaults to `5`.
