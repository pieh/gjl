import io from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import { createContext } from "react";

import {
  SOCKET_UNSUBSCRIBE,
  SOCKET_PROJECT_LIST,
  SOCKET_PROJECT_INFO,
  SOCKET_PROJECT_SAMPLES,
  SOCKET_PROJECT_RUN_ADD_TAG,
  SOCKET_PROJECT_RUN_REMOVE_TAG,
  SOCKET_PROJECT_SET_REMOTE_ID,
} from "../shared/constants";

import firebase from "firebase/app";

// These imports load individual services into the firebase namespace.
import "firebase/auth";
import "firebase/firestore";
import "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyABeCBrmU2SEFRc7hX2vpm3S-mtdVvWB1g",
  authDomain: "gjldb-12356.firebaseapp.com",
  projectId: "gjldb-12356",
  storageBucket: "gjldb-12356.appspot.com",
  messagingSenderId: "636961727650",
  appId: "1:636961727650:web:dc946e8453443cc67263fb",
};

const app = firebase.initializeApp(firebaseConfig);

export const getDB = () => firebase.firestore();

export const getStorage = () => firebase.storage();

export { app as firebaseApp };

const socket = io("localhost:3010");

function subscribe(type, params = {}) {
  const uuid = uuidv4();

  socket.emit(type, { ...params, uuid });

  return function unsubscribe() {
    socket.emit(SOCKET_UNSUBSCRIBE, { uuid });
  };
}

export function getProjectList(handler) {
  socket.on(SOCKET_PROJECT_LIST.data, handler);
  const unsubscribe = subscribe(SOCKET_PROJECT_LIST.listen);

  return () => {
    socket.off(SOCKET_PROJECT_LIST.data, handler);
    unsubscribe();
  };
}

export function getProjectInfo(project, handler) {
  socket.on(SOCKET_PROJECT_INFO.data, handler);
  const unsubscribe = subscribe(SOCKET_PROJECT_INFO.listen, { project });

  return () => {
    socket.off(SOCKET_PROJECT_INFO.data, handler);
    unsubscribe();
  };
}

export function getProjectSamples(project, timestamp, handler) {
  socket.on(SOCKET_PROJECT_SAMPLES.data, handler);
  const unsubscribe = subscribe(SOCKET_PROJECT_SAMPLES.listen, {
    project,
    timestamp,
  });

  return () => {
    socket.off(SOCKET_PROJECT_SAMPLES.data, handler);
    unsubscribe();
  };
}

export function metaAddTag(project, timestamp, tag) {
  socket.emit(SOCKET_PROJECT_RUN_ADD_TAG, { project, timestamp, tag });
}

export function metaRemoveTag(project, timestamp, tag) {
  socket.emit(SOCKET_PROJECT_RUN_REMOVE_TAG, { project, timestamp, tag });
}

export function metaSetRemoteID(project, timestamp, remoteID) {
  socket.emit(SOCKET_PROJECT_SET_REMOTE_ID, { project, timestamp, remoteID });
}

export const AuthContext = createContext(null);
