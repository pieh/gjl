import React, { useEffect, useState } from "react";
import { Link } from "gatsby";
import { getProjectList } from "../api";

export default function IndexPage() {
  const [projectList, setProjectList] = useState([]);

  useEffect(() => {
    return getProjectList((projects) => {
      setProjectList(projects);
    });
  }, [setProjectList]);

  return (
    <div>
      <h1>Projects</h1>
      <ul>
        {projectList.map((project) => (
          <li key={project.id}>
            <Link to={`/project/${project.id}`}>{project.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
