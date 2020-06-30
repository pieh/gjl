import React, { useEffect, useState } from "react";
import { Link } from "gatsby";
import { getProjectInfo } from "../../api";

export default function ProjectRunsPage({ project }) {
  const [projectInfo, setProjectInfo] = useState({
    name: ``,
    runs: {},
  });
  console.log(`halo`);
  useEffect(() => {
    return getProjectInfo(project, (projectInfo) => {
      console.log({ projectInfo });
      setProjectInfo(projectInfo);
    });
  }, [project, setProjectInfo]);

  return (
    <div>
      <h1>
        Project <code>{projectInfo.name}</code>
      </h1>
      <ul>
        {Object.values(projectInfo.runs).map((run) => (
          <li key={run.timestamp}>
            <Link to={`/run/${project}/${run.timestamp}`}>{run.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
