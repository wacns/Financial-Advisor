import React, { useEffect, useState } from "react";
import { Card, Heading, Muted, Button, Row } from "./ui.jsx";
import { updateStatus, checkUpdate, installUpdate, subscribeUpdates } from "../platform/updates";
export default function AppUpdates() {
  const [status, setStatus] = useState({ state: "loading", message: "Reading update status…" });
  useEffect(() => {
    let active = true;
    updateStatus().then((value) => { if (active) setStatus(value); }).catch(() => {
      if (active) setStatus({ state: "error", message: "Could not read update status." });
    });
    const stop = subscribeUpdates((value) => { if (active) setStatus(value); });
    return () => { active = false; stop(); };
  }, []);
  async function check() {
    setStatus({ state: "checking", message: "Checking for updates…" });
    try { setStatus(await checkUpdate()); }
    catch { setStatus({ state: "error", message: "Could not check for updates. Try again later." }); }
  }
  async function install() {
    try { await installUpdate(); }
    catch { setStatus({ state: "error", message: "Could not restart for the update. Try again later." }); }
  }
  return <Card>
    <Heading>App updates</Heading>
    <Muted>{status.message}</Muted>
    {status.version ? <Muted>Version {status.version}</Muted> : null}
    <Row>
      {!["loading", "web", "unconfigured", "unsupported"].includes(status.state) ? <Button secondary disabled={["checking", "downloading", "ready"].includes(status.state)} onPress={check}>Check for updates</Button> : null}
      {status.state === "ready" ? <Button onPress={install}>Restart and install update</Button> : null}
    </Row>
  </Card>;
}
