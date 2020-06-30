import React, { useRef, useEffect } from "react";

import { getDB, getStorage } from "../../api";
import RunView from "../../components/run-view";

export default function ProjectRunsPage({ project, timestamp }) {
  const getProjectInfoRef = useRef({});
  const getProjectSamplesRef = useRef({});

  const remoteID = `${project}+${timestamp}`;

  useEffect(() => {
    getDB()
      .collection(`runs`)
      .doc(remoteID)
      .get()
      .then((doc) => {
        console.log({ doc });
        const data = doc.data();

        const projectInfo = {
          name: data.name,
          id: project,
          runs: {
            [timestamp]: {
              timestamp,
              label: new Date(parseInt(timestamp)).toLocaleString(),
              meta: data.meta,
            },
          },
        };

        if (getProjectInfoRef.current[remoteID]) {
          getProjectInfoRef.current[remoteID](projectInfo);
        }
      });

    const storageRef = getStorage().ref();
    const eventsFileRef = storageRef.child(`${remoteID}.json`);

    eventsFileRef.getDownloadURL().then(async (url) => {
      const response = await fetch(url);
      const events = await response.json();
      console.log({ events });
      if (getProjectSamplesRef.current[remoteID]) {
        getProjectSamplesRef.current[remoteID](events);
      }
    });

    return () => {
      delete getProjectInfoRef.current[remoteID];
      delete getProjectSamplesRef.current[remoteID];
    };
  }, [project, timestamp, remoteID]);

  function getProjectInfo(_, handler) {
    getProjectInfoRef.current[remoteID] = handler;
  }

  function getProjectSamples(_, _2, handler) {
    getProjectSamplesRef.current[remoteID] = handler;
  }

  return (
    <RunView
      getProjectInfo={getProjectInfo}
      project={project}
      timestamp={timestamp}
      getProjectSamples={getProjectSamples}
    >
      {({ chart, projectInfo }) => {
        return (
          <>
            {projectInfo?.runs?.[timestamp]?.meta?.tags?.length && (
              <>
                <h2>Tags</h2>
                <ul>
                  {projectInfo.runs[timestamp].meta.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </>
            )}
            {chart}
          </>
        );
      }}
    </RunView>
  );
}
