import React, { useContext } from "react";
import { Link } from "gatsby";

import {
  getProjectInfo,
  getProjectSamples,
  metaAddTag,
  metaRemoveTag,
  AuthContext,
  getDB,
  getStorage,
  metaSetRemoteID,
} from "../../../api";
import RunView from "../../../components/run-view";

export default function ProjectRunsPage({ project, timestamp }) {
  const user = useContext(AuthContext);

  return (
    <RunView
      getProjectInfo={getProjectInfo}
      project={project}
      timestamp={timestamp}
      getProjectSamples={getProjectSamples}
    >
      {({ chart, projectInfo, events }) => {
        return (
          <>
            <h2>Tags</h2>
            {projectInfo?.runs?.[timestamp]?.meta?.tags?.length ? (
              <ul>
                {projectInfo.runs[timestamp].meta.tags.map((tag) => (
                  <li key={tag}>
                    <button
                      title="remove tag"
                      onClick={() => {
                        metaRemoveTag(project, timestamp, tag);
                      }}
                    >
                      x
                    </button>
                    {` `}
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
            <label>
              Add new tag{` `}
              <input
                type="text"
                onKeyDown={(event) => {
                  if (event.keyCode === 13) {
                    const tag = event.target.value;
                    metaAddTag(project, timestamp, tag);
                    event.target.value = ``;

                    //wat
                  }
                }}
              />
            </label>
            <h2>Upload</h2>
            <div>
              {user ? (
                <>
                  <button
                    onClick={() => {
                      const dbName = `${project}+${timestamp}`;
                      const storageRef = getStorage().ref();
                      const eventsFileRef = storageRef.child(`${dbName}.json`);

                      eventsFileRef
                        .putString(JSON.stringify(events), `raw`, {
                          contentType: `application/json`,
                        })
                        .then((snapshot) => {
                          console.log({ storageRef, snapshot, eventsFileRef });

                          const remoteInfo = {
                            author_uid: user.uid,
                            name: projectInfo.name,
                            timestamp,
                            project,
                            meta: projectInfo?.runs[timestamp]?.meta,
                          };

                          // console.log({ remoteInfo });

                          const doc = getDB().collection(`runs`).doc(dbName);

                          doc.set(remoteInfo).then(() => {
                            metaSetRemoteID(project, timestamp, dbName);
                            // console.log({ snapshot });
                          });
                        });
                    }}
                  >
                    {projectInfo?.runs[timestamp]?.meta?.remoteID
                      ? `update`
                      : `upload`}
                  </button>
                  {projectInfo?.runs[timestamp]?.meta?.remoteID && (
                    <>
                      {" "}
                      <Link to={`/${project}/${timestamp}`}>
                        <code>
                          /{project}/{timestamp}
                        </code>
                      </Link>
                    </>
                  )}
                </>
              ) : (
                <>Need to sign in to upload</>
              )}
            </div>
            {chart}
            <h4>Runs</h4>
            <ul>
              {Object.values(projectInfo.runs).map((run) => (
                <li key={run.timestamp}>
                  <Link to={`/run/${project}/${run.timestamp}`}>
                    {run.label}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        );
      }}
    </RunView>
  );
}
