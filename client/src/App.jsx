import React, { useEffect, useState } from "react";
import io from "socket.io-client";

// Connect to the backend server running on port 3001
const socket = io.connect("https://prompt-deception-production.up.railway.app");

function App() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Listen for connection
    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Cleanup listeners
    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Prompt Deception</h1>
      <h3>
        Server Status:{" "}
        <span style={{ color: isConnected ? "green" : "red" }}>
          {isConnected ? "CONNECTED 🟢" : "DISCONNECTED 🔴"}
        </span>
      </h3>
    </div>
  );
}

export default App;