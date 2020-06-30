import React, { useEffect, useState } from "react";
import { Link } from "gatsby";

import { auth } from "firebaseui";
import "firebaseui/dist/firebaseui.css";

import { firebaseApp, AuthContext } from "../api";

console.log({ firebaseApp: firebaseApp });

const ui = new auth.AuthUI(firebaseApp.auth());

const AuthInit = Symbol(`init`);

export default function Layout({ children }) {
  const [authContext, setAuthContext] = useState(AuthInit);
  useEffect(() => {
    firebaseApp.auth().onAuthStateChanged((user) => {
      console.log({ user });
      setAuthContext(user);
    });
  }, [setAuthContext]);

  useEffect(() => {
    if (authContext === null) {
      ui.start("#login-div", {
        signInOptions: [
          firebaseApp.firebase_.auth.GithubAuthProvider.PROVIDER_ID,
        ],
        signInSuccessUrl: window.location.toString(),
      });
    }
  }, [authContext]);

  return (
    <AuthContext.Provider value={authContext === AuthInit ? null : authContext}>
      <div style={{ display: `flex`, justifyContent: `space-between` }}>
        <Link to="/">Home</Link>
        {authContext !== AuthInit && authContext === null ? (
          <div id="login-div" />
        ) : (
          <div>
            {authContext.displayName}{" "}
            <button
              onClick={() => {
                firebaseApp.auth().signOut();
              }}
            >
              Logout
            </button>
          </div>
        )}

        {/* <button
          onClick={() => {
            ui.start("#login-div", {
              signInOptions: [
                firebaseApp.firebase_.auth.GithubAuthProvider.PROVIDER_ID,
              ],
            });
          }}
        >
          login
        </button> */}
      </div>

      {children}
    </AuthContext.Provider>
  );
}
