import React, { useEffect, useState, useRef } from "react";

import { INTERVAL_TIME } from "../../shared/constants";
// import {
//   getProjectInfo,
//   getProjectSamples,
//   metaAddTag,
//   metaRemoveTag,
//   AuthContext,
//   getDB,
//   getStorage,
//   metaSetRemoteID,
// } from "../api";
import Chart from "./chart";

function handleEvent(runData, elapsed, frame) {
  let dataFrameIndex = -1;
  for (let i = runData.data.length - 1; i >= 0; i--) {
    let currentFrame = runData.data[i];
    if (currentFrame.elapsed < elapsed - INTERVAL_TIME / 2) {
      break;
    }

    if (currentFrame.elapsed < elapsed + INTERVAL_TIME / 2) {
      dataFrameIndex = i;
    }
  }

  if (dataFrameIndex !== -1) {
    const existingFrame = runData.data[dataFrameIndex];
    const combinedFrame = Object.entries(frame).reduce((acc, [key, value]) => {
      if (typeof acc[key] !== `undefined`) {
        acc[key] = Math.max(acc[key], value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, existingFrame);

    runData.data[dataFrameIndex] = {
      ...combinedFrame,
      elapsed: Math.min(elapsed, existingFrame.elapsed),
    };
    return;
  }

  const frameWithTime = {
    elapsed,
    ...frame,
  };
  if (runData.data.length > 0 && elapsed < runData.data[0].elapsed) {
    runData.data.unshift(frameWithTime);
  } else {
    runData.data.push(frameWithTime);
  }
}

export default function ProjectRunsPage({
  getProjectInfo,
  getProjectSamples,
  project,
  timestamp,
  children,
}) {
  const ref = useRef({});

  const [projectInfo, setProjectInfo] = useState({
    name: ``,
    runs: {},
  });

  const [runData, setRunData] = useState({
    activities: [],
    data: [],
    processes: [],
  });

  useEffect(() => {
    ref.current = {
      activities: [],
      data: [],
      processes: [],
      startedActivities: {},
      meta: {},
      events: [],
    };

    const unsample = getProjectSamples(project, timestamp, (events) => {
      const { sortActivities, ...runData } = events.reduce(
        (runData, event) => {
          runData.events.push(event);
          if (event.type === `PROCESS_REGISTER`) {
            runData.processes.push({
              ...event,
              index: runData.processes.length,
            });
            runData.meta[`cpu_max_${event.pid}`] = 0;
            runData.meta[`mem_max_${event.pid}`] = 0;
            runData.meta[`delay_max_${event.pid}`] = 0;
            runData.meta[`start_${event.pid}`] = event.elapsed;
          } else if (event.type === `ACTIVITY_START`) {
            const activity = {
              uuid: event.uuid,
              label: event.label,
              start: event.elapsed,
              end: null,
            };
            runData.activities.push(activity);
            runData.startedActivities[event.uuid] = activity;
            runData.sortActivities = true;
          } else if (event.type === `ACTIVITY_END`) {
            const startedActivity = runData.startedActivities[event.uuid];
            if (startedActivity) {
              startedActivity.end = event.elapsed;
              runData.sortActivities = true;
              delete runData.startedActivities[event.uuid];
            } else {
              console.debug(`Activity ended without starting`, event);
            }
          } else if (event.type === `CPU_MEM`) {
            handleEvent(runData, event.elapsed, {
              [`cpu_${event.pid}`]: event.cpu,
              [`mem_${event.pid}`]: event.mem,
            });
            runData.meta[`cpu_max_${event.pid}`] = Math.max(
              runData.meta[`cpu_max_${event.pid}`],
              event.cpu
            );
            runData.meta[`mem_max_${event.pid}`] = Math.max(
              runData.meta[`mem_max_${event.pid}`],
              event.mem
            );
            runData.meta[`end_${event.pid}`] = event.elapsed;
            // {type: "CPU_MEM", pid: 10647, mem: 226373632, cpu: 0, elapsed: 41123}
          } else if (event.type === `EVENT_LOOP_DELAY`) {
            // {type: "EVENT_LOOP_DELAY", delay: 0, pid: 10737, elapsed: 36604}
            handleEvent(runData, event.elapsed, {
              [`delay_${event.pid}`]: event.delay,
            });
            runData.meta[`delay_max_${event.pid}`] = Math.max(
              runData.meta[`delay_max_${event.pid}`],
              event.delay
            );
            runData.meta[`end_${event.pid}`] = event.elapsed;
          } else if (event.type === `SET_STATUS`) {
            const metaKey =
              event.status === `IN_PROGRESS` ? `main_start` : `main_end`;
            if (typeof runData.meta[metaKey] === `undefined`) {
              runData.meta[metaKey] = event.elapsed;
            }
          } else {
            console.debug(`Unhandled event type`, event);
          }

          return runData;
        },
        { ...ref.current, sortActivities: false }
      );

      setRunData(runData);
    });

    const uninfo = getProjectInfo(project, (projectInfo) => {
      setProjectInfo(projectInfo);
    });

    return function unsubscribe() {
      if (unsample) {
        unsample();
      }
      if (uninfo) {
        uninfo();
      }
    };
  }, [
    project,
    timestamp,
    setProjectInfo,
    setRunData,
    getProjectInfo,
    getProjectSamples,
  ]);

  return (
    <div>
      <h1>
        Project <code>{projectInfo.name}</code>
      </h1>
      {children({
        chart: <Chart {...runData} />,
        projectInfo,
        events: ref.current.events,
      })}
    </div>
  );
}
