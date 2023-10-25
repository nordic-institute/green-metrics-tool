const calculateStats = (energy_measurements, time_measurements, cpu_util_measurements) => {
    let energyAverage = '--'
    let energyStdDeviation = '--'
    let energyStdDevPercent = '--'
    let energySum = '--';

    let timeAverage = '--'
    let timeStdDeviation = '--'
    let timeStdDevPercent = '--'
    let timeSum = '--';

    let cpuUtilStdDeviation = '--'
    let cpuUtilAverage = '--'
    let cpuUtilStdDevPercent = '--'

    if (energy_measurements.length > 0) {
        energyStdDeviation = Math.round(math.std(energy_measurements, normalization="uncorrected"));
        energyAverage = Math.round(math.mean(energy_measurements));
        energyStdDevPercent = Math.round((energyStdDeviation / energyAverage) * 100);
        energySum = Math.round(math.sum(energy_measurements));
    }

    if (time_measurements.length > 0) {
        timeStdDeviation = Math.round(math.std(time_measurements, normalization="uncorrected"));
        timeAverage = Math.round(math.mean(time_measurements));
        timeStdDevPercent = Math.round((timeStdDeviation / timeAverage) * 100);
        timeSum = Math.round(math.sum(time_measurements));
    }

    if (cpu_util_measurements.length > 0) {
        cpuUtilStdDeviation = Math.round(math.std(cpu_util_measurements, normalization="uncorrected"));
        cpuUtilAverage = Math.round(math.mean(cpu_util_measurements));
        cpuUtilStdDevPercent = Math.round((cpuUtilStdDeviation / cpuUtilAverage) * 100);
    }

    return {
        energy: {
            average: energyAverage,
            stdDeviation: energyStdDeviation,
            stdDevPercent: energyStdDevPercent,
            total: energySum
        },
        time: {
            average: timeAverage,
            stdDeviation: timeStdDeviation,
            stdDevPercent: timeStdDevPercent,
            total: timeSum
        },
        cpu_util: {
            average: cpuUtilAverage,
            stdDeviation: cpuUtilStdDeviation,
            stdDevPercent: cpuUtilStdDevPercent
        },
    };
};

// rename me, getStaticChartOptions, put zoomOptions into getChartOptions
const getEChartsOptions = (zoomOptions) => {
    if (zoomOptions == null) {
        zoomOptions = {
            xStart: 0,
            xEnd: 100,
            yStart: 0,
            yEnd:100
        }
    }
    return {
        yAxis: { type: 'value', gridIndex: 0, name: "Run Energy" },

        xAxis: {type: "category", data: []},
        series: [],
        title: { text: null },
        animation: false,
        legend: {
            data: [],
            top: 20,
            // type: 'scroll' // maybe active this if legends gets too long
        },
        dataZoom: [
        {
          show: true,
          realtime: true,
          start: zoomOptions.xStart,
          end: zoomOptions.xEnd
        },
        {
          type: 'inside',
          realtime: true,
          start: 65,
          end: 85
        },
        {
          show: true,
          yAxisIndex: 0,
          filterMode: 'empty',
          width: 30,
          height: '80%',
          showDataShadow: false,
          left: '93%',
          start: zoomOptions.yStart,
          end: zoomOptions.yEnd
        }
      ],
    };
}

const getChartOptions = (measurements, zoomOptions, chart_type = 'energy', legendStatus=null) => {
    const options = getEChartsOptions(zoomOptions);
    if (chart_type == 'cpu_util') {
        options.title.text = `Workflow Cpu Utilization used per Run[%]`;
        options.yAxis.name = "CPU Utilization [%]"
    } else if (chart_type == 'duration') {
        options.title.text = `Workflow Duration per Run [s]`;
        options.yAxis.name = "Duration [s]"
    } else {
        options.title.text = `Workflow Energy Cost per Run [mJ]`;
        options.yAxis.name = "Run Energy [mJ]"
    }

    const legend = new Set()
    const tooltip_info = []
    const run_ids = []
    const labels_used_overall = []
    let run_count = 0

    // Create the data series
    measurements.runs.forEach(run => {
        run_count++
        if (!run_ids.includes(run.run_id)) {
            options.xAxis.data.push(dateToYMD(new Date(run.timestamp), short=true))
            run_ids.push(run.run_id)
        }

        let labels_used_in_run = {}

        run.labels.forEach(label => {
            let label_name = label.label_name ? label.label_name : 'None'
            let value=null;
            if (chart_type == 'cpu_util') {
                value = label.cpu_util ? label.cpu_util : null
            } else if (chart_type == 'duration') {
                value = label.duration ? label.duration : null
            } else {
                value = label.energy_value ? label.energy_value : null
            }

            //if label_name is not in labels_used_overall, create new series, and zero fill
            if(!labels_used_overall.includes(label_name)) {
                let series_values = new Array(run_count-1).fill(0)
                series_values.push(value)
                options.series.push({
                    type: 'bar',
                    smooth: true,
                    stack: "0",
                    name: label_name,
                    data: series_values,
                    itemStyle: {
                        borderWidth: .5,
                        borderColor: '#000000',
                      },
                })
                tooltip_info.push({
                    label: label_name,
                    energy_values: new Array(run_count-1).fill(0).concat(label.energy_value),
                    unit: label.energy_unit,
                    cpu: new Array(run_count-1).fill(0).concat(label.cpu_model),
                    run_ids: new Array(run_count-1).fill(0).concat(run.run_id),
                    cpu_utils: new Array(run_count-1).fill(0).concat(label.cpu_util),
                    durations: new Array(run_count-1).fill(0).concat(label.duration),
                    commit_hashs: new Array(run_count-1).fill(0).concat(run.commit),
                    timestamps: new Array(run_count-1).fill(0).concat(label.timestamp),
                });
                labels_used_overall.push(label_name)
                labels_used_in_run[label_name] = 1
                legend.add(label_name)
            }
            // if its not a new label, but new in this run, find the first series of this name and push the value
            else if (!labels_used_in_run.hasOwnProperty(label_name)) {
                let matchingSeries = options.series.find(series => series.name === label_name)
                matchingSeries.data.push(value)
                let matchingTooltip = tooltip_info.find(tooltip => tooltip.label === label_name)
                matchingTooltip.energy_values.push(label.energy_value)
                matchingTooltip.cpu.push(label.cpu_model)
                matchingTooltip.run_ids.push(run.run_id)
                matchingTooltip.cpu_utils.push(label.cpu_util)
                matchingTooltip.durations.push(label.duration)
                matchingTooltip.commit_hashs.push(run.commit)
                matchingTooltip.timestamps.push(label.timestamp)
                labels_used_in_run[label_name] = 1
            }
            // else it must be a label already used in this run
            // in which case look for the nth series of this name (n = number of times this label has shown un in this run)
            // and either push the value or create it if it doesn't exist (0 filled)
            else {
                let series_count = 0
                let matchingSeries = options.series.find(series => {
                    if (series.name === label_name) {
                        series_count++;
                        return series_count === labels_used_in_run[label_name] + 1;
                    }
                    return false;
                });
                if(matchingSeries){
                    matchingSeries.data.push(value)
                    let tooltip_series_count = 0
                    let matchingTooltip = tooltip_info.find(tooltip => {
                        if (tooltip.label === label_name) {
                            tooltip_series_count++;
                            return tooltip_series_count === labels_used_in_run[label_name] + 1;
                        }
                        return false;
                    });
                    matchingTooltip.energy_values.push(label.energy_value)
                    matchingTooltip.cpu.push(label.cpu_model)
                    matchingTooltip.run_ids.push(run.run_id)
                    matchingTooltip.cpu_utils.push(label.cpu_util)
                    matchingTooltip.durations.push(label.duration)
                    matchingTooltip.commit_hashs.push(run.commit)
                    matchingTooltip.timestamps.push(label.timestamp)

                    labels_used_in_run[label_name]++
                }
                else {
                    let series_values = new Array(run_count-1).fill(0)
                    series_values.push(value)
                    options.series.push({
                        type: 'bar',
                        smooth: true,
                        stack: "0",
                        name: label_name,
                        data: series_values,
                        itemStyle: {
                            borderWidth: .5,
                            borderColor: '#000000',
                          },
                    })
                    tooltip_info.push({
                        label: label_name,
                        energy_values: new Array(run_count-1).fill(0).concat(label.energy_value),
                        unit: label.energy_unit,
                        cpu: new Array(run_count-1).fill(0).concat(label.cpu_model),
                        run_ids: new Array(run_count-1).fill(0).concat(run.run_id),
                        cpu_utils: new Array(run_count-1).fill(0).concat(label.cpu_util),
                        durations: new Array(run_count-1).fill(0).concat(label.duration),
                        commit_hashs: new Array(run_count-1).fill(0).concat(run.commit),
                        timestamps: new Array(run_count-1).fill(0).concat(label.timestamp),
                    });
                    labels_used_overall.push(label_name)
                    labels_used_in_run[label_name]++
                }
            }
        });

        // push zeros to all tooltip labels that weren't used
        const max_length = tooltip_info.reduce((maxLength, tooltip) => Math.max(maxLength, tooltip.energy_values.length), 0);
        tooltip_info.forEach(tooltip => {
            while (tooltip.energy_values.length < max_length) {
                tooltip.energy_values.push(0);
                tooltip.cpu.push(0);
                tooltip.run_ids.push(0);
                tooltip.cpu_utils.push(0);
                tooltip.durations.push(0);
                tooltip.commit_hashs.push(0);
                tooltip.timestamps.push(0);
            }
        });


        // for each label in the series that was not used during labels_used_in_run, push a 0 value
        // this also resets labels_used_in_run
        options.series.forEach(series => {
            // first the labels that weren't used at all
            if (!labels_used_in_run.hasOwnProperty(series.name)) {
                series.data.push(0)
            }
            // then all the duplicate labels that weren't used
            else { (labels_used_in_run[series.name] <= 0) ? series.data.push(0) : labels_used_in_run[series.name]--; }
        })
    });

    // Set the Legend
    options.legend.data = measurements.labels.map(labelObj => labelObj.name);
    if(legendStatus == null) {
        options.legend.selected = {}
        options.legend.data.forEach(label => {
            options.legend.selected[label] = true
        })
    } else {
        options.legend.selected = legendStatus
    }

    options.tooltip = {
        trigger: 'item',
        formatter: function (params, ticket, callback) {
            return `
            <strong>Label: ${escapeString(params.seriesName)}</strong><br>
            <strong>CPU: ${escapeString(tooltip_info[params.componentIndex].cpu[params.dataIndex])}</strong><br>
            energy used: ${escapeString(tooltip_info[params.componentIndex].energy_values[params.dataIndex])} ${escapeString(tooltip_info[params.componentIndex].unit)}<br>
            duration: ${escapeString(tooltip_info[params.componentIndex].durations[params.dataIndex])} seconds<br>
            avg. cpu. utilization: ${escapeString(tooltip_info[params.componentIndex].cpu_utils[params.dataIndex])}%<br>
            run_id: ${escapeString(tooltip_info[params.componentIndex].run_ids[params.dataIndex])}<br>
            timestamp: ${tooltip_info[params.componentIndex].timestamps[params.dataIndex]}<br>
            commit_hash: ${escapeString(tooltip_info[params.componentIndex].commit_hashs[params.dataIndex])}<br>
            `;
        }
    };
    console.log("Options:")
    console.log(options)
    return options
}

const displayGraph = (measurements, zoomOptions=null, value_type = 'energy') => {
    const element = document.querySelector(`#ci-runs-chart`);

    const options = getChartOptions(measurements, zoomOptions, value_type); // iterates
    const chart_instance = echarts.init(element);
    chart_instance.setOption(options);
    
    window.onresize = function () { // set callback when ever the user changes the viewport
        chart_instance.resize();
    }

    return chart_instance;
}

const displayStatsTable = (measurements) => {
    const tableBody = document.querySelector("#label-stats-table");
    tableBody.innerHTML = "";

    const full_run_stats_node = document.createElement("tr")

    measurements.runs.forEach(run => {
        run.stats = calculateStats(run.labels.map(label => label.energy_value), run.labels.map(label => label.duration), run.labels.map(label => label.cpu_util))
    });
    measurements.labels.forEach(label => {
        label.stats = calculateStats(label.energy_values.map(x => x.value), label.duration_values.map(x => x.value), label.cpu_util_values.map(x => x.value))
    });
    const full_run_stats = calculateStats(measurements.runs.map(run => run.stats.energy.average), measurements.runs.map(run => run.stats.time.average), measurements.runs.map(run => run.stats.cpu_util.average))
    console.log("displayStatsTable measurements.labels")
    console.log(measurements.labels)
    full_run_stats_node.innerHTML += `
                            <td class="td-index" data-tooltip="Stats for the series of runs (labels aggregated for each pipeline run)">Full Run <i class="question circle icon small"></i> </td>
                            <td class="td-index">${formatLongValue(full_run_stats.energy.average)} mJ</td>
                            <td class="td-index">${formatLongValue(full_run_stats.energy.stdDeviation)} mJ</td>
                            <td class="td-index">${full_run_stats.energy.stdDevPercent}%</td>
                            <td class="td-index">${formatLongValue(full_run_stats.time.average)}s</td>
                            <td class="td-index">${formatLongValue(full_run_stats.time.stdDeviation)}s</td>
                            <td class="td-index">${full_run_stats.time.stdDevPercent}%</td>
                            <td class="td-index">${formatLongValue(full_run_stats.cpu_util.average)}%</td>
                            <td class="td-index">${formatLongValue(full_run_stats.energy.total)} mJ</td>
                            <td class="td-index">${formatLongValue(full_run_stats.time.total)}s</td>
                            <td class="td-index">${formatLongValue(measurements.measurement_count)}</td>
                            `
    tableBody.appendChild(full_run_stats_node);

    measurements.labels.forEach(label => {
        const label_stats = label.stats
        const label_stats_node = document.createElement("tr")
        label_stats_node.innerHTML += `
                                        <td class="td-index" data-tooltip="stats for the series of steps represented by the ${label.name} label">${label.name}</td>
                                        <td class="td-index">${formatLongValue(label_stats.energy.average)} mJ</td>
                                        <td class="td-index">${formatLongValue(label_stats.energy.stdDeviation)} mJ</td>
                                        <td class="td-index">${label_stats.energy.stdDevPercent}%</td>
                                        <td class="td-index">${formatLongValue(label_stats.time.average)}s</td>
                                        <td class="td-index">${formatLongValue(label_stats.time.stdDeviation)}s</td>
                                        <td class="td-index">${label_stats.time.stdDevPercent}%</td>
                                        <td class="td-index">${formatLongValue(label_stats.cpu_util.average)}%</td>
                                        <td class="td-index">${formatLongValue(label_stats.energy.total)} mJ</td>
                                        <td class="td-index">${formatLongValue(label_stats.time.total)}s</td>
                                        <td class="td-index">${formatLongValue(label.count)}</td>
                                        `
        document.querySelector("#label-stats-table").appendChild(label_stats_node);
    });
}

const displayFullDataTable = (measurements, url_params) => {
    const repo_esc = escapeString(url_params.get('repo'))
    const source = measurements.source

    measurements.runs.forEach(run => {
        const run_row_node = document.createElement("tr");

        const run_id_esc = escapeString(run.run_id)

        if(source == 'github') {
            run_link = `https://github.com/${repo_esc}/actions/runs/${run_id_esc}`;
        }
        else if (source == 'gitlab') {
            run_link = `https://gitlab.com/${repo_esc}/-/pipelines/${run_id_esc}`
        }

        const run_link_node = `<a href="${run_link}" target="_blank">${run_id_esc}</a>`
        const tooltip = `title="${run.commit}"`;
        const short_hash = run.commit.substring(0, 7);

        run_row_node.innerHTML = `
                        <td rowspan="${run.labels.length}" class="td-index">${run_link_node}</td>\
                        <td class="td-index">${escapeString(run.labels[0].label_name)}</td>\
                        <td class="td-index"><span title="${escapeString(run.labels[0].timestamp)}">${dateToYMD(new Date(run.labels[0].timestamp))}</span></td>\
                        <td class="td-index">${formatLongValue(run.labels[0].energy_value)}</td>\
                        <td class="td-index">${escapeString(run.labels[0].cpu_model)}</td>\
                        <td class="td-index">${run.labels[0].cpu_util}%</td>
                        <td class="td-index">${run.labels[0].duration} seconds</td>
                        <td class="td-index" ${escapeString(tooltip)}>${escapeString(short_hash)}</td>\
        `;
        document.querySelector("#ci-table").appendChild(run_row_node);
        if (run.labels.length > 0) {
            run.labels.slice(1).forEach(label => {
                const li_node = document.createElement("tr");
                li_node.innerHTML = `
                        <td class="td-index">${escapeString(label.label_name)}</td>\
                        <td class="td-index"><span title="${escapeString(label.timestamp)}">${dateToYMD(new Date(label.timestamp))}</span></td>\
                        <td class="td-index">${formatLongValue(label.energy_value)}</td>\
                        <td class="td-index">${escapeString(label.cpu_model)}</td>\
                        <td class="td-index">${label.cpu_util}%</td>
                        <td class="td-index">${label.duration} seconds</td>
                        <td class="td-index" ${escapeString(tooltip)}>${escapeString(short_hash)}</td>\
                        `;
                document.querySelector("#ci-table").appendChild(li_node)
            });
        }
    });
    $('ci-table').tablesort();
}

const transformMeasurements = (measurements) => {
    const result = {
        measurements: {
            workflow_name: measurements[0][10],
            source: measurements[0][8],
            runs: [],
            run_count: 0,
            max_labels: 0,
            measurement_count: 0,
            labels: [],
            cpus: [],
            stats: {}
        },
    };

    let runMap = {};
    let labelMap = {}

    measurements.forEach((measurement) => {
        const [value, unit, run_id, timestamp, label, cpu, commit_hash, duration, source, cpu_util] = measurement;
        result.measurements.measurement_count++;

        if (!result.measurements.cpus.includes(cpu)) {
            result.measurements.cpus.push(cpu);
        }

        let runData = runMap[run_id];
        if (!runData) {
            runData = {
                run_id: run_id,
                timestamp: null,
                commit: commit_hash,
                labels: [],
                energy_total: 0,
                stats: {},
                duration_total: 0,
                cpu_util_total: 0,

            };
            runMap[run_id] = runData;
            result.measurements.run_count++;
            result.measurements.runs.push(runData);
        }

        runData.energy_total += value !== null ? value : 0;
        runData.duration_total += duration !== null ? duration : 0;
        runData.cpu_util_total += cpu_util !== null ? cpu_util : 0;

        runData.labels.push({
            label_name: label,
            cpu_model: cpu,
            cpu_util: cpu_util,
            energy_value: value,
            energy_unit: unit,
            duration: duration,
            timestamp: timestamp,
        });

        let labelData = labelMap[label];

        if (!labelData) {
            labelData = {
                name: label,
                count: 0,
                energy_values: [],
                duration_values: [],
                cpu_util_values: [],
                stats: {}
            }
            labelMap[label] = labelData;
            result.measurements.labels.push(labelData);
        }

        value !== null && labelData.energy_values.push({run: run_id, value: value});
        duration !== null && labelData.duration_values.push({run: run_id, value: duration});
        cpu_util !== null && labelData.cpu_util_values.push({run: run_id, value: cpu_util});
        labelData.count++;
        
        if (result.measurements.max_labels < runData.labels.length) {
            result.measurements.max_labels = runData.labels.length;
        }

        // Update the timestamp for the run if it's the first valid timestamp
        if (timestamp !== null && (runData.timestamp === null || timestamp < runData.timestamp)) {
            runData.timestamp = timestamp;
        }
    });
    
    // Sort the runs by timestamp in ascending order (earliest to latest)
    result.measurements.runs.sort((a, b) => {
      const timestampA = new Date(a.timestamp);
      const timestampB = new Date(b.timestamp);

      if (isNaN(timestampA) && isNaN(timestampB)) {
        return 0;
      } else if (isNaN(timestampA)) {
        return 1;
      } else if (isNaN(timestampB)) {
        return -1;
      } else {
        return timestampA - timestampB;
      }
    });
    return result.measurements;
}


    // make a state object called Filters which keeps track of the current xaxis start/end, selected legends, and currently displayed CPU
    // when the user changes the xaxis, selected legends, or CPU, the graph is re-rendered with the new state
        // Turn this into a Filters state object
        // This keeps track of the start/end zooms, filtered cpus, filterd legends
        // and is applied on top of each gragh render
        // this can be its own class, with getters/setters
        // setter can also render the graph
        // Filter State Object can have a "return data" function that applies the filter to Measurements (which never change!)
        // and returns the subset to display in both Graph and Stats Table
class Filter {
    constructor(chart_instance, measurements, legends, cpus) {
        this._chart_instance = chart_instance;
        this._measurements = measurements;
        this._selectedLegends = legends;
        this._selectedCPUs = cpus;
        this._tab = 'energy';
        this._zoom = {
            xStart: 0,
            xEnd: 100,
            yStart: 0,
            yEnd:100
        };
        this._firstRun = 0;
        this._lastRun = measurements.run_count - 1;

    }

    setZoom (zoom, start, end) {
        this._zoom = zoom;
        this._firstRun = start;
        this._lastRun = end;
        //this.filterMeasurements()
        let result = this.filterMeasurements()
        displayStatsTable(result);
    }

    setSelectedLegends(selectedLegends){
        this._selectedLegends = selectedLegends;
        this.filterMeasurements()
        displayStatsTable(this._filteredMeasurements);
    }

    setSelectedCPUs(selectedCPUs) {
        this._selectedCPUs = selectedCPUs;
        //this.filterMeasurements()
        //displayStatsTable(this._filteredMeasurements);
        this.renderGraph();
    }

    setTab(tab) {
        this._tab = tab
        //this.filterMeasurements()
        //displayStatsTable(this._filteredMeasurements);
        this.renderGraph();
    }

    // Inefficient and currently doesn't work.
    // it continues to modify the original this._measurements object, which it cannot do
    // not sure of solution here
    filterMeasurements() {
        console.log("filterMeasurements this._measurements:")
        console.log(this._measurements)
        // Create a new object to store the filtered measurements
        let filteredMeasurements = {
            runs: [],
            labels: [],
        };

        // Filter the runs
        filteredMeasurements.runs = this._measurements.runs.slice(this._firstRun, this._lastRun + 1);

        // Create a set of label names that are still present in the filtered runs
        let labelNamesInFilteredRuns = new Set();
        filteredMeasurements.runs.forEach(run => {
            run.labels.forEach(run_label => {
                labelNamesInFilteredRuns.add(run_label.label_name);
            });
        });

        // Filter the labels
        filteredMeasurements.labels = this._measurements.labels.filter(label => {
            return labelNamesInFilteredRuns.has(label.name);
        });

        // Create a set of run_ids that are in the filtered runs
        let runIdsInFilteredRuns = new Set(filteredMeasurements.runs.map(run => run.run_id));

        // Filter the cpu_util_values for each label
        filteredMeasurements.labels.forEach(label => {
            label.cpu_util_values = label.cpu_util_values.filter(cpu_util => {
                return runIdsInFilteredRuns.has(cpu_util.run);
            });
        });

        // Calculate the measurement count
        filteredMeasurements.measurement_count = filteredMeasurements.runs.reduce((acc, run) => acc + run.labels.length, 0);

        return filteredMeasurements;

/*        this._filteredMeasurements.runs.forEach(run => {
            const filteredLabels = run.labels.filter(label => {
                return (
                    this._selectedLegends.hasOwnProperty(label.label_name) &&
                    this._selectedCPUs.includes(label.cpu_model)
                );
            });
            console.log("filteredLabels")
            console.log(filteredLabels)
        });


        this._filteredMeasurements.labels = this._filteredMeasurements.labels.filter(label => {
            return this._selectedLegends.hasOwnProperty(label.name);
        });

        this._filteredMeasurements.cpus = this._filteredMeasurements.cpus.filter(cpu => {
            return this._selectedCPUs.hasOwnProperty(cpu);
        });*/
        
    }

    renderGraph(measurements) {
        const options = getChartOptions(measurements, this._zoom, this._tab, this._selectedLegends);
        this._chart_instance.clear();
        this._chart_instance.setOption(options);
    }
}

const validateParams = (url_params) => {
    // Validate URL Params
    if (url_params.get('repo') == null || url_params.get('repo') == '' || url_params.get('repo') == 'null') {
        showNotification('No Repo', 'Repo parameter in URL is empty or not present. Did you follow a correct URL?');
        return;
    }
    if (url_params.get('branch') == null || url_params.get('branch') == '' || url_params.get('branch') == 'null') {
        showNotification('No Branch', 'Branch parameter in URL is empty or not present. Did you follow a correct URL?');
        return;
    }
    if (url_params.get('workflow') == null || url_params.get('workflow') == '' || url_params.get('workflow') == 'null') {
        showNotification('No Workflow', 'Workflow parameter in URL is empty or not present. Did you follow a correct URL?');
        return;
    }

}

const loadBadge = (url_params) => {    
    try {
        const link_node = document.createElement("a")
        const img_node = document.createElement("img")
        img_node.src = `${API_URL}/v1/ci/badge/get?repo=${url_params.get('repo')}&branch=${url_params.get('branch')}&workflow=${url_params.get('workflow')}`
        link_node.href = window.location.href
        link_node.appendChild(img_node)
        document.querySelector("span.energy-badge-container").appendChild(link_node)
        document.querySelector(".copy-badge").addEventListener('click', copyToClipboard)
    } catch (err) {
        showNotification('Could not get badge data from API', err);
    }
}

const showInfoTab = (url_params, measurements) => {
    let repo_link = ''
    const source = measurements.source
    const workflow_id = escapeString(url_params.get('workflow'))
    const workflow_name = measurements.workflow_name

    if (workflow_name == '' || workflow_name == null) {
        workflow_name = workflow_id ;
    }

    if(source == 'github') {
        repo_link = `https://github.com/${escapeString(url_params.get('repo'))}`;
    }
    else if(source == 'gitlab') {
        repo_link = `https://gitlab.com/${escapeString(url_params.get('repo'))}`;
    }

    const repo_link_node = `<a href="${repo_link}" target="_blank">${escapeString(url_params.get('repo'))}</a>`
    const ci_data_node = document.querySelector('#ci-data')
    ci_data_node.insertAdjacentHTML('afterbegin', `<tr><td><strong>Repository:</strong></td><td>${repo_link_node}</td></tr>`)
    ci_data_node.insertAdjacentHTML('afterbegin', `<tr><td><strong>Branch:</strong></td><td>${escapeString(url_params.get('branch'))}</td></tr>`)
    ci_data_node.insertAdjacentHTML('afterbegin', `<tr><td><strong>Workflow ID:</strong></td><td>${workflow_id}</td></tr>`)
    ci_data_node.insertAdjacentHTML('afterbegin', `<tr><td><strong>Workflow:</strong></td><td>${workflow_name}</td></tr>`)

}

$(document).ready((e) => {
    (async () => {
        const query_string = window.location.search;
        const url_params = (new URLSearchParams(query_string))

        validateParams(url_params)
        loadBadge(url_params)

        // Get Measurements Data
        try {
            const api_string=`/v1/ci/measurements?repo=${url_params.get('repo')}&branch=${url_params.get('branch')}&workflow=${url_params.get('workflow')}`;
            var response = await makeAPICall(api_string);
        } catch (err) {
            showNotification('Could not get data from API', err);
            return;
        }

        // Transform Data into something usable
        let measurements = transformMeasurements(response.data);
        console.log("Transformed Measurements:")
        console.log(measurements)

        showInfoTab(url_params, measurements)
        displayFullDataTable(measurements, url_params)
        displayStatsTable(measurements)


        // Get the tab elements using the container's ID
        const chartTypes = document.getElementById('chart-types');
        const tabs = chartTypes.querySelectorAll('a');
        let chart_instance = displayGraph(measurements, "energy")

        //get measurements.labels.names as an array
        const labelsArray = measurements.labels.map(label => label.name)

        var filter = new Filter(chart_instance, measurements, labelsArray, measurements.cpus)

        // Function to execute when a tab is clicked
        function tabClicked(event) {
            // Remove the 'active' class from all tabs
            tabs.forEach(tab => {
                tab.classList.remove('active');
            });

            // Set the clicked tab as afilter.ctive
            event.target.classList.add('active');
            const tabId = event.target.getAttribute('data-tab');
            const element = document.querySelector(`#chart-container`);

            filter.setTab(tabId)
        }

        // Add click event listeners to the tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', tabClicked);
        });

        $('#chart-types.menu .item').tab({
            onLoad: function(value, text) {
                window.dispatchEvent(new Event('resize'));
            }
        }); 

        // On legend change, recalculate stats table
        chart_instance.on('legendselectchanged', function (params) {
            // get list of all legends that are on
            const newLegends = params.selected;
            filter.setSelectedLegends(newLegends)    // re-renders the stats
        });

        chart_instance.on('datazoom', function (event) {
            var option = chart_instance.getOption();
            let newZoom = {}
            newZoom.xStart = option.dataZoom[0].start;           // This is the percentage (0-100)
            newZoom.xEnd = option.dataZoom[0].end;               // also percentage (0-100)
            const startValue = option.dataZoom[0].startValue;    // this is the index (0 default)
            const endValue = option.dataZoom[0].endValue;        // also the index (n default)
            filter.setZoom(newZoom, startValue, endValue)        // re-renders the Stats Table
        });

        const cpu_dropdown = document.getElementById("cpu-dropdown");
        measurements.cpus.forEach(cpu => {
            const cpu_node = document.createElement("option")
            cpu_node.value = cpu
            cpu_node.innerHTML = cpu
            cpu_dropdown.appendChild(cpu_node)
        });

        cpu_dropdown.addEventListener("change", function () {
            const selected_cpu = cpu_dropdown.value;
            (selected_cpu == "all-cpus") ? filter.setSelectedCPUs(measurements.cpus) : filter.setSelectedCPUs([selected_cpu])
        });

        setTimeout(function(){window.dispatchEvent(new Event('resize'))}, 500);
    })();
});
