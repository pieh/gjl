import React, { useEffect, useState } from "react";
import { Router } from "@reach/router";
import { Link } from "gatsby";

import Chart from "../components/chart";

import Socket from "../socket";
import useLocalStorage from "../hooks/useLocalStorage";

const Index = () => {
  const [projectList, setProjectList] = useState([]);
  useEffect(() => {
    const handler = (test) => {
      setProjectList(test);
    };
    Socket.on(`projectList`, handler);

    Socket.emit(`getProjectList`);
    return () => {
      Socket.off(`projectList`, handler);
    };
  }, [setProjectList]);

  return (
    <div>
      <h1>Projects</h1>
      <ul>
        {projectList.map((project) => (
          <li key={project.id}>
            <Link to={`/${project.id}`}>{project.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Tag = ({ projectID, value, timestamp, projectTags, setProjectTags }) => {
  return (
    <span>
      {" "}
      <button
        onClick={(e) => {
          e.preventDefault();
          projectTags[projectID][timestamp] = projectTags[projectID][
            timestamp
          ].filter((t) => value !== t);
          setProjectTags({ ...projectTags });
        }}
      >
        X
      </button>{" "}
      {value}
    </span>
  );
};

const ProjectRunsIndex = ({ projectID }) => {
  const [projectInfo, setProjectInfo] = useState({
    name: ``,
    runs: [],
  });

  useEffect(() => {
    const handler = (test) => {
      if (test) {
        setProjectInfo({
          name: test.name,
          runs: Object.keys(test.runs).map((timestamp) => {
            timestamp = parseInt(timestamp);
            return {
              label: new Date(timestamp).toLocaleString(),
              id: timestamp,
            };
          }),
        });
      }
    };
    Socket.on(`projectInfo`, handler);
    Socket.emit(`getProjectInfo`, { projectID });
    return () => {
      Socket.off(`projectInfo`, handler);
    };
  }, [projectID, setProjectInfo]);

  return (
    <div>
      <h1>
        Project <code>{projectInfo.name}</code>
      </h1>
      <ul>
        {projectInfo.runs.map((run) => (
          <li key={run.id}>
            <Link to={`/${projectID}/${run.id}`}>{run.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProjectSamples = ({ projectID, timestamp }) => {
  const [projectInfo, setProjectInfo] = useState({
    name: ``,
    runs: [],
  });
  const [label, setLabel] = useState(``);
  const [chartData, setChartData] = useState([]);
  const [activities, setActivities] = useState([]);
  const [processes, setProcesses] = useState([]);

  const [projectTags, setProjectTags] = useLocalStorage(
    `project_${projectID}`,
    {}
  );

  // console.log(projectTags)

  useEffect(() => {
    setLabel(new Date(parseInt(timestamp)).toLocaleString());

    const data = [];
    const tmp_processes = [];
    const lineToIndex = {};

    const projectInfoHandler = (test) => {
      if (test) {
        setProjectInfo({
          name: test.name,
          runs: Object.keys(test.runs).map((timestamp) => {
            timestamp = parseInt(timestamp);
            return {
              label: new Date(timestamp).toLocaleString(),
              id: timestamp,
            };
          }),
        });
      }
    };

    let line = 0;
    const runDataHandler = (newData) => {
      // console.log(`runDataHandler`, { newData })
      newData.forEach((row) => {
        const processId = row[4] || `N/A`;
        if (!tmp_processes.includes(processId)) {
          tmp_processes.push(processId);
        }
        // if (!data[processId]) {
        //   data[processId] = []
        // }
        // data[processId].push(row)
        // data.push(row)

        const entry = {
          time: row[0],
          [`${processId}_cpu`]: row[1],
          [`${processId}_mem`]: row[2],
        };

        // maybe merge with last entry
        if (
          data.length > 0 &&
          Math.abs(data[data.length - 1].time - row[0]) < 0.2
        ) {
          data[data.length - 1] = {
            ...data[data.length - 1],
            ...entry,
          };
        } else {
          // for (let i = data.length; i >= 0 && Math.abs(data[i].time - row[0]) < 200 ) {}

          data.push({
            index: data.length,
            ...entry,
          });
        }
        lineToIndex[line++] = data.length - 1;
      });
      setChartData([...data]);
      setProcesses([...tmp_processes]);
    };

    const runActivitiesHandler = (activities) => {
      setActivities(
        activities.map((activity) => {
          return {
            ...activity,
            start: lineToIndex[activity.start],
            end: lineToIndex[activity.end],
          };
        })
      );
    };

    Socket.on(`projectInfo`, projectInfoHandler);
    Socket.on(`runData`, runDataHandler);
    Socket.on(`runActivities`, runActivitiesHandler);
    Socket.emit(`getProjectRun`, { projectID, timestamp });

    return () => {
      Socket.off(`projectInfo`, projectInfoHandler);
      Socket.off(`runData`, runDataHandler);
      Socket.off(`runActivities`, runActivitiesHandler);
    };
  }, [setProjectInfo, projectID, timestamp, setChartData, setActivities]);

  // console.log({ chartData })

  return (
    <div>
      <h1>
        Project{" "}
        <Link to={`/${projectID}`}>
          <code>{projectInfo.name}</code>
        </Link>{" "}
        - {label}
      </h1>

      <Chart
        chartData={chartData}
        activities={activities}
        processes={processes}
      />
      <div>
        <h4>Tags</h4>
        <input
          type="text"
          onKeyDown={(event) => {
            if (event.keyCode === 13) {
              const tag = event.target.value;
              event.target.value = ``;
              console.log("save", tag);

              if (!projectTags[projectID]) {
                projectTags[projectID] = {};
              }

              if (!projectTags[projectID][timestamp]) {
                projectTags[projectID][timestamp] = [];
              }

              if (!projectTags[projectID][timestamp].includes(tag)) {
                projectTags[projectID][timestamp].push(tag);
                setProjectTags({ ...projectTags });
              }
            }
          }}
        />
        {projectTags[projectID] &&
          projectTags[projectID][timestamp] &&
          projectTags[projectID][timestamp].length > 0 && (
            <ul>
              {projectTags[projectID][timestamp].map((tag, index) => (
                <li key={index}>
                  <Tag
                    projectID={projectID}
                    timestamp={timestamp}
                    value={tag}
                    projectTags={projectTags}
                    setProjectTags={setProjectTags}
                  />
                  {/* <button
                  onClick={e => {
                    e.preventDefault()
                    projectTags[projectID] = projectTags[projectID].filter(
                      t => tag !== t
                    )
                    setProjectTags({ ...projectTags })
                  }}
                >
                  X
                </button>{" "}
                {tag} */}
                </li>
              ))}
            </ul>
          )}
      </div>
      <h4>Runs</h4>
      <ul>
        {projectInfo.runs.map((run) => (
          <li key={run.id}>
            <Link to={`/${projectID}/${run.id}`}>{run.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default () => {
  return (
    <React.Fragment>
      <nav>
        <ul>
          <li>
            <Link to="/">Index</Link>
          </li>
        </ul>
      </nav>
      <Router>
        <ProjectSamples path="/:projectID/:timestamp" />
        <ProjectRunsIndex path="/:projectID" />
        <Index path="/" default />
      </Router>
    </React.Fragment>
  );
};
