import React, { useEffect, useState } from "react";
import { Link, navigate } from "gatsby";
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
      <h1>GJL</h1>
      <h2>Recorded sessions</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/` + e.target.elements.remoteID.value);
        }}
      >
        <label>
          Session ID: <input type="text" name="remoteID" />
        </label>
        <input type="submit" value="Go" />
      </form>
      {projectList.length > 0 && (
        <>
          <h1>Projects</h1>
          <ul>
            {projectList.map((project) => (
              <li key={project.id}>
                <Link to={`/project/${project.id}`}>{project.name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
