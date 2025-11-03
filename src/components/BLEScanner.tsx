import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ---------------- Minimal Web Bluetooth type shims (safe augmentations) --------------- */
declare global {
  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string | null;
    gatt?: BluetoothRemoteGATTServer;
  }

  interface BluetoothRemoteGATTServer {
    device: BluetoothDevice;
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
  }

  interface BluetoothLEScan {
    active?: boolean;
    keepRepeatedDevices?: boolean;
    acceptAllAdvertisements?: boolean;
    stop(): void;
  }
}
/* -------------------------------------------------------------------------------------- */

type SeenDevice = {
  id: string;
  name: string;
  rssi?: number | null;
  txPower?: number | null;
  uuids?: string[];
  lastSeen: number; // epoch ms
  device?: BluetoothDevice; // if we got a real device reference
};

const supportsWebBluetooth = () =>
  typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

const supportsScanning = () =>
  supportsWebBluetooth() &&
  typeof (navigator as any).bluetooth.requestLEScan === "function";

export default function BLEScanner() {
  const [devices, setDevices] = useState<Record<string, SeenDevice>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<string | null>(null);

  const advHandlerRef = useRef<(ev: any) => void>();
  const leScanRef = useRef<BluetoothLEScan | null>(null);

  const sorted = useMemo(() => {
    const list = Object.values(devices);
    // Sort by (1) most recent, (2) strongest RSSI if present, (3) name
    return list.sort((a, b) => {
      if (b.lastSeen !== a.lastSeen) return b.lastSeen - a.lastSeen;
      const rssiA = a.rssi ?? -999, rssiB = b.rssi ?? -999;
      if (rssiB !== rssiA) return rssiB - rssiA;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [devices]);

  const hasDevices = Object.keys(devices).length > 0;
  const statusText = useMemo(() => {
    if (scanError) return null; // show error separately
    if (isScanning && !hasDevices) return "Scanning for BLE devices…";
    if (isScanning && hasDevices) return `Found ${Object.keys(devices).length} device(s)`;
    if (!isScanning && !hasDevices) return "No BLE devices found.";
    return `Found ${Object.keys(devices).length} device(s)`;
  }, [isScanning, hasDevices, devices, scanError]);

  const addOrUpdate = useCallback((d: Partial<SeenDevice> & { id: string }) => {
    setDevices(prev => {
      const old = prev[d.id];
      const merged: SeenDevice = {
        id: d.id,
        name: d.name ?? old?.name ?? "Unknown",
        rssi: d.rssi ?? old?.rssi,
        txPower: d.txPower ?? old?.txPower,
        uuids: d.uuids ?? old?.uuids,
        lastSeen: d.lastSeen ?? Date.now(),
        device: (d as any).device ?? old?.device,
      };
      return { ...prev, [d.id]: merged };
    });
  }, []);

  // ---- Standard chooser (works everywhere Web Bluetooth is supported) ----
  const chooseDevice = useCallback(async () => {
    setScanError(null);
    setConnectStatus(null);
    if (!supportsWebBluetooth()) {
      setScanError("This browser doesn't support Web Bluetooth.");
      return;
    }
    try {
      // Adjust optionalServices if you know targeted services
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [],
      });
      if (!device) {
        setScanError("No device selected or found.");
        return;
      }

      addOrUpdate({
        id: device.id,
        name: device.name ?? "Unknown",
        device,
        lastSeen: Date.now(),
      });

      // Optionally attempt a connection:
      setConnectStatus("Connecting…");
      const server = await device.gatt?.connect();
      setConnectStatus(server ? "Connected" : "Failed to connect");
      device.addEventListener("gattserverdisconnected", () => {
        setConnectStatus("Disconnected");
      });
    } catch (err: any) {
      if (err?.name === "NotFoundError") {
        // user closed chooser; not an error
        return;
      }
      setScanError(err?.message ?? String(err));
    }
  }, [addOrUpdate]);

  // ---- Experimental scanning (lists nearby devices) ----
  const startScan = useCallback(async () => {
    setScanError(null);
    setConnectStatus(null);

    if (!supportsScanning()) {
      setScanError(
        "BLE scanning not supported in this browser. Use the 'Choose device' button instead."
      );
      return;
    }

    try {
      // Requires a user gesture. Some browsers may demand site permission first.
      const scan = await (navigator as any).bluetooth.requestLEScan({
        // accept all advertisements (may require chrome flag on some platforms)
        keepRepeatedDevices: true,
        acceptAllAdvertisements: true,
      });

      leScanRef.current = scan;
      setIsScanning(true);

      const onAdv = (event: any) => {
        try {
          const id: string = event?.device?.id ?? event?.uuid ?? crypto.randomUUID();
          const name: string =
            event?.device?.name ?? event?.name ?? "Unknown";
          const rssi: number | undefined = event?.rssi;
          const txPower: number | undefined = event?.txPower;
          const uuids: string[] | undefined = event?.uuids;

          addOrUpdate({
            id,
            name,
            rssi,
            txPower,
            uuids,
            lastSeen: Date.now(),
            device: event?.device,
          });
        } catch {
          // swallow a bad packet
        }
      };

      advHandlerRef.current = onAdv;
      (navigator as any).bluetooth.addEventListener(
        "advertisementreceived",
        onAdv
      );
    } catch (err: any) {
      setScanError(err?.message ?? String(err));
      setIsScanning(false);
    }
  }, [addOrUpdate]);

  const stopScan = useCallback(() => {
    try {
      if (advHandlerRef.current) {
        (navigator as any).bluetooth.removeEventListener(
          "advertisementreceived",
          advHandlerRef.current
        );
        advHandlerRef.current = undefined;
      }
      leScanRef.current?.stop?.();
    } catch {
      // ignore
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    return () => stopScan(); // cleanup on unmount
  }, [stopScan]);

  const canScan = supportsScanning();
  const canUseChooser = supportsWebBluetooth();

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>BLE Devices</span>
          <div className="flex gap-2">
            {canScan && (
              isScanning ? (
                <Button variant="secondary" onClick={stopScan}>
                  Stop scan
                </Button>
              ) : (
                <Button onClick={startScan}>Scan nearby</Button>
              )
            )}
            {canUseChooser && (
              <Button variant="outline" onClick={chooseDevice}>
                Choose device
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!canUseChooser && !canScan && (
          <p className="text-sm text-muted-foreground">
            This browser does not support Web Bluetooth. Try Chrome or Edge over HTTPS (or localhost).
          </p>
        )}

        {/* Status & errors */}
        {scanError && (
          <p className="text-sm text-red-600 mb-3">{scanError}</p>
        )}
        {connectStatus && (
          <p className="text-sm text-muted-foreground mb-3">{connectStatus}</p>
        )}
        {statusText && !scanError && (
          <p className="text-xs text-muted-foreground mb-3">{statusText}</p>
        )}

        {/* Devices List */}
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No devices yet. Click <strong>Scan nearby</strong> (experimental) or <strong>Choose device</strong> to open the browser device picker.
          </p>
        ) : (
          <ul className="divide-y">
            {sorted.map((d) => (
              <li key={d.id} className="py-3 flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    {d.name}{" "}
                    <span className="text-xs text-muted-foreground">({d.id})</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-x-3">
                    {typeof d.rssi === "number" && <span>RSSI: {d.rssi} dBm</span>}
                    {typeof d.txPower === "number" && <span>Tx: {d.txPower} dBm</span>}
                    {d.uuids?.length ? <span>UUIDs: {d.uuids.join(", ")}</span> : null}
                    <span>Last seen: {new Date(d.lastSeen).toLocaleTimeString()}</span>
                  </div>
                </div>
                {d.device && (
                  <DeviceControls device={d.device} />
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceControls({ device }: { device: BluetoothDevice }) {
  const [status, setStatus] = useState<string>(device.gatt?.connected ? "Connected" : "Disconnected");

  useEffect(() => {
    const onDisc = () => setStatus("Disconnected");
    device.addEventListener("gattserverdisconnected", onDisc);
    return () => device.removeEventListener("gattserverdisconnected", onDisc);
  }, [device]);

  const connect = useCallback(async () => {
    try {
      setStatus("Connecting…");
      const server = await device.gatt?.connect();
      setStatus(server ? "Connected" : "Failed to connect");
    } catch (e: any) {
      setStatus(e?.message ?? "Connect failed");
    }
  }, [device]);

  const disconnect = useCallback(() => {
    try {
      device.gatt?.disconnect();
    } catch {/* ignore */}
  }, [device]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{status}</span>
      {device.gatt?.connected ? (
        <Button size="sm" variant="secondary" onClick={disconnect}>Disconnect</Button>
      ) : (
        <Button size="sm" onClick={connect}>Connect</Button>
      )}
    </div>
  );
}