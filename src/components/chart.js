import React, { useState, useEffect } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  Brush,
  XAxis,
  YAxis,
  ReferenceArea,
  Tooltip,
  Legend,
} from "recharts";

const _1MB = 1024 * 1024;

const memoryFormatter = (value) => {
  return `${Math.round(value / _1MB)} MB`;
};

// const cpuFormatter = (value) => {
//   return `${Math.round(value)}%`;
// };

const timeFormatter = (value) => `${parseFloat(value / 1000).toFixed(2)}s`;

function rankProcTag(proc) {
  if (proc.tag === `Gatsby develop child`) {
    return 0;
  } else if (proc.tag === `Gatsby main`) {
    return 1;
  } else if (proc.tag === `Gatsby telemetry server child`) {
    return 2;
  } else if (proc.tag === `Gatsby recipes graphql server`) {
    return 3;
  } else if (proc.tag === `Gatsby telemetry send`) {
    return 4;
  } else if (proc.tag === `Gatsby default pool worker`) {
    return 5;
  } else if (proc.tag === `Gatsby dev ssr pool worker`) {
    return 6;
  } else if (proc.tag === `Terser webpack plugin pool worker`) {
    return 7;
  }

  return 8;
}

const lineColors = {
  memory: `#ff0000`,
  cpu: `#00ff00`,
  eventLoopDelay: `#0000ff`,
};

const colors = [
  "#75eab6",
  "#459da1",
  "#b4dbe7",
  "#34a54f",
  "#7cee4d",
  "#859947",
  "#c0e15c",
  "#e6861f",
  "#f68d92",
  "#fd5917",
  "#eed288",
  "#a98a7f",
  "#fcd107",
  "#3a91fb",
  "#d992e2",
  "#f642d0",
  "#ff4d82",
].map((a) => `${a}40`);

const TooltipValueRow = ({ label, value, fill, stroke }) => {
  return (
    <div style={{ display: `flex`, justifyContent: `space-between` }}>
      <div>
        <div
          style={{
            display: `inline-block`,
            verticalAlign: `middle`,
            marginRight: `0.5em`,
            width: `1em`,
            height: `1em`,
            position: `relative`,
            background: fill || `inherit`,
          }}
        >
          {stroke && (
            <div
              style={{
                position: `absolute`,
                left: 0,
                top: `50%`,
                right: 0,
                borderTop: `2px solid ${stroke}`,
              }}
            />
          )}
        </div>
        {label}
      </div>
      {value && <code style={{ marginLeft: `1em` }}>{value}</code>}
    </div>
  );
};

const CustomTooltip = ({
  active,
  label: frame,
  payload,
  activities,
  chartData,
  ...wat
}) => {
  if (!active || !payload) {
    return null;
  }
  const currentActivities = activities.filter((activity) => {
    const isAfterStart = frame >= activity.start;
    const isBeforeEnd = activity.end === null || frame <= activity.end;

    return isAfterStart && isBeforeEnd;
  });

  return (
    <div
      style={{
        background: `white`,
        padding: `1em`,
        border: `1px solid gray`,
        lineHeight: 1.4,
      }}
    >
      <TooltipValueRow label="Time" value={timeFormatter(frame)} />
      <hr />
      {payload.map((payloadItem) => (
        <TooltipValueRow
          key={payloadItem.dataKey}
          stroke={payloadItem.stroke}
          label={payloadItem.name}
          value={
            /*
        
            payloadItem.name === `CPU usage`
              ? cpuFormatter(payloadItem.value)
              :*/
            payloadItem.name === `Memory usage`
              ? memoryFormatter(payloadItem.value)
              : payloadItem.name === `Event loop delay`
              ? timeFormatter(payloadItem.value)
              : payloadItem.value
          }
        />
      ))}
      <hr />
      {currentActivities.map((activity, i) => {
        const duration =
          activity.end !== null
            ? timeFormatter(activity.end - activity.start)
            : `-`;

        return (
          <TooltipValueRow
            key={i}
            fill={colors[activity.index % colors.length]}
            label={activity.label}
            value={duration}
          />
        );
      })}
    </div>
  );
};

export default ({ data, activities: rawActivities, processes, meta }) => {
  const [range, setRange] = useState({
    startIndex: null,
    endIndex: null,
  });

  const [selectedProcesses, setSelectedProcesses] = useState([]);
  // const mainProcessRef = useRef();
  // const processGroups = useRef();

  const [{ mainProcess, processGroups }, setProcessedProcesses] = useState({
    mainProcess: null,
    processGroups: [],
    // selected: [],
  });

  const [showInProgress /* , _setShowInProgress */] = useState(true);

  useEffect(() => {
    const groupByTag = {};
    processes.forEach((proc) => {
      if (!groupByTag[proc.tag]) {
        groupByTag[proc.tag] = [];
      }

      groupByTag[proc.tag].push(proc);
    });

    const processGroups = Object.entries(groupByTag)
      .reduce((acc, [tag, procs]) => {
        acc.push({ tag, procs });
        return acc;
      }, [])
      .sort((a, b) => {
        return rankProcTag(a) - rankProcTag(b);
      });

    setProcessedProcesses({
      mainProcess: processGroups.length > 0 ? processGroups[0].procs[0] : null,
      processGroups,
    });
  }, [processes, setProcessedProcesses]);

  if (data.length < 2) {
    return null;
  }

  let displayedProcesses = selectedProcesses;
  if (displayedProcesses.length === 0 && mainProcess) {
    displayedProcesses = [mainProcess];
  }

  const elapsedStart = data[0].elapsed;
  const elapsedEnd = data[data.length - 1].elapsed;

  const shouldShowOnlyInProgress =
    false && (meta.main_start || meta.main_end) && showInProgress;

  const rangeEnd =
    shouldShowOnlyInProgress && meta.main_end
      ? meta.main_end
      : range.endIndex
      ? data[range.endIndex].elapsed
      : elapsedEnd;

  const rangeStart =
    shouldShowOnlyInProgress && meta.main_start
      ? meta.main_start
      : range.startIndex
      ? data[range.startIndex].elapsed
      : elapsedStart;

  const { activities, maxLevel } = rawActivities.reduce(
    (acc, activity, index) => {
      const activityEnd = activity.end || rangeEnd;

      if (activity.start > rangeEnd || activityEnd < rangeStart) {
        return acc;
      }

      const actualStart = Math.max(activity.start, rangeStart);
      const actualEnd = Math.min(activityEnd, rangeEnd);

      if (actualEnd === actualStart) {
        return acc;
      }

      const placementTracker = acc.placementTracker;

      let level = -1;
      let foundSpot = false;
      while (!foundSpot) {
        level++;
        if (level < placementTracker.length) {
          const somePlacement = placementTracker[level];
          if (actualStart >= somePlacement.end) {
            foundSpot = true;
            somePlacement.end = actualEnd;
          }
        } else {
          const placement = {
            end: actualEnd,
            level,
          };
          placementTracker.push(placement);
          foundSpot = true;
        }
      }

      acc.maxLevel = Math.max(acc.maxLevel, level);

      const retval = {
        ...activity,
        index,
        level,
        startOnGraph: actualStart,
        endOnGraph: actualEnd,
        isStartInGraph: activity.start - rangeStart >= 0,
        isEndInGraph: activity.end ? activityEnd <= rangeEnd : false,
      };

      acc.activities.push(retval);

      return acc;
    },
    {
      areas: [],
      activities: [],
      placementTracker: [],
      maxLevel: 0,
    }
  );

  const charts = displayedProcesses.map(({ pid: processId, label }, index2) => {
    return (
      <React.Fragment key={processId}>
        <h3>{label ?? `PID: ${processId}`}</h3>
        <div style={{ height: `80vh` }}>
          <ResponsiveContainer>
            <LineChart
              key={processId}
              data={data}
              syncId="sync"
              margin={{ top: 60, right: 30, left: 0, bottom: 0 }}
            >
              <Brush
                y={0}
                dataKey="elapsed"
                endIndex={
                  shouldShowOnlyInProgress
                    ? meta.main_end ?? null
                    : range.endIndex === data.length
                    ? null
                    : range.endIndex
                }
                startIndex={range.startIndex === 0 ? null : range.startIndex}
                tickFormatter={(_value, index) => {
                  console.log({ _value, index });
                  // return timeFormatter(data[index].elapsed);
                  return _value;
                }}
                onChange={(vals) => {
                  if (!shouldShowOnlyInProgress) {
                    setRange(vals);
                  }
                }}
              />
              <XAxis
                xAxisId="time"
                dataKey="elapsed"
                label="time"
                type="number"
                domain={() => [rangeStart, () => rangeEnd]}
                tickFormatter={timeFormatter}
                ticks={10}
              />
              {/* <YAxis
                yAxisId="cpu"
                domain={[() => 0, () => meta[`cpu_max_${processId}`]]}
                tickFormatter={cpuFormatter}
                label={{ value: "CPU usage", angle: -90 }}
              /> */}
              <YAxis
                yAxisId="delay"
                domain={[0, () => meta[`delay_max_${processId}`]]}
                tickFormatter={timeFormatter}
                label={{ value: "Event loop delay", angle: -90 }}
              />
              <YAxis yAxisId="area" domain={[0, 100]} hide={true} />
              <YAxis
                yAxisId="mem"
                orientation="right"
                tickFormatter={memoryFormatter}
                domain={[0, () => meta[`mem_max_${processId}`]]}
                label={{ value: "Memory usage", angle: -90 }}
              />
              <Tooltip
                isAnimationActive={false}
                content={
                  <CustomTooltip activities={activities} chartData={data} />
                }
              />
              {activities.map((activity) => (
                <ReferenceArea
                  key={activity.index}
                  y1={100 - activity.level * (100 / (maxLevel + 1))}
                  y2={100 - (activity.level + 1) * (100 / (maxLevel + 1))}
                  label={{
                    value: activity.label,
                    angle: -90,
                  }}
                  fill={colors[activity.index % colors.length]}
                  x1={activity.startOnGraph}
                  x2={activity.endOnGraph}
                  yAxisId="area"
                  xAxisId="time"
                  ifOverflow="visible"
                />
              ))}
              {/* <Line
                yAxisId="cpu"
                xAxisId="time"
                name="CPU usage"
                isAnimationActive={false}
                // dot={false}
                dataKey={`cpu_${processId}`}
                stroke="#8884d8"
                fill="#8884d8"
                connectNulls={true}
              /> */}
              <Line
                yAxisId="mem"
                xAxisId="time"
                name="Memory usage"
                isAnimationActive={false}
                // dot={false}
                dataKey={`mem_${processId}`}
                stroke={lineColors.memory}
                fill={lineColors.memory}
                connectNulls={true}
              />
              <Line
                yAxisId="delay"
                xAxisId="time"
                name="Event loop delay"
                isAnimationActive={false}
                dot={{ strokeWidth: 5 }}
                // dot={false}
                dataKey={`delay_${processId}`}
                stroke={lineColors.eventLoopDelay}
                fill={lineColors.eventLoopDelay}
                // connectNulls={true}
              />
              <Legend verticalAlign="bottom" height={36} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </React.Fragment>
    );
  });

  return (
    <>
      <h2>View settings</h2>
      {/* {(meta.main_start || meta.main_end) && (
        <label>
          <input
            type="checkbox"
            checked={showInProgress}
            onChange={(e) => setShowInProgress(e.target.value)}
          />
          Show time when gatsby is reporting is in progress
        </label>
      )} */}
      <h3>Displayed processes</h3>
      <ul
        style={{
          display: `flex`,
          flexWrap: `wrap`,
          gap: `1rem`,
          margin: 0,
          padding: 0,
        }}
      >
        {mainProcess && (
          <li style={{ display: `block` }}>
            {" "}
            <label>
              <input
                type="checkbox"
                checked={selectedProcesses.length === 0}
                onChange={() => setSelectedProcesses([])}
              />
              Auto ({mainProcess.label})
            </label>
          </li>
        )}
        {processGroups.map((procGroup) => (
          <li style={{ display: `block` }} key={procGroup.tag}>
            {procGroup.procs.map((proc) => (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedProcesses.includes(proc)}
                    onChange={(e) => {
                      console.log(proc.label, e.target.checked);
                      const index = selectedProcesses.indexOf(proc);
                      if (index === -1) {
                        setSelectedProcesses(
                          [...selectedProcesses, proc].sort((a, b) => {
                            const d = rankProcTag(a) - rankProcTag(b);
                            if (d === 0) {
                              return a.index - b.index;
                            } else {
                              return d;
                            }
                          })
                        );
                      } else {
                        const copy = [...selectedProcesses];
                        copy.splice(index, 1);
                        console.log({
                          index,
                          selectedProcesses,
                          after: copy,
                        });

                        setSelectedProcesses(copy);
                      }
                    }}
                  />
                  {proc.label === `N/A` ? proc.argv[1] : proc.label}
                </label>
              </div>
            ))}
          </li>
        ))}
      </ul>
      <h2>Charts</h2>
      {charts}
    </>
  );
};
