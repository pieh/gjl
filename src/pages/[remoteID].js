import React from "react";
import View from "./[project]/[timestamp]";

export default function RemoteIDPage({ remoteID }) {
  const [project, timestamp] = remoteID ? remoteID.split(`+`) : [];

  return <View project={project} timestamp={timestamp} />;
}
