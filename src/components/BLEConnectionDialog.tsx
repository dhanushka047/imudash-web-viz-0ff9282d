import React from "react";
import { useBLE } from "@/hooks/useBLE";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnect: (deviceName: string) => void; // your Index.tsx callback
};

export function BLEConnectionDialog({ open, onOpenChange, onConnect }: Props) {
  const {
    devices,
    hasDevices,
    isScanning,
    scanError,
    connectMessage,
    connectedDevice,
    statusText,
    supports,
    startScan,
    stopScan,
    chooseDevice,
    connect,
    disconnect,
    validUUIDFound,
    packetsReceived,
    lastPacketHex,
  } = useBLE();

  const handleChoose = async () => {
    const device = await chooseDevice();
    if (device) {
      const ok = await connect(device);
      if (ok && validUUIDFound) {
        onConnect(device.name ?? "Unknown");
        onOpenChange(false); // close only after UUIDs valid
      }
    }
  };

  const handleConnectFromList = async (id: string) => {
    const d = devices.find(x => x.id === id)?.device;
    if (d) {
      const ok = await connect(d);
      if (ok && validUUIDFound) {
        onConnect(d.name ?? "Unknown");
        onOpenChange(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && connectedDevice) disconnect();
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect to a BLE Device</DialogTitle>
          <DialogDescription>
            The app will validate the service and characteristic and start notifications.
          </DialogDescription>
        </DialogHeader>

        {!supports.webBluetooth && (
          <p className="text-sm text-red-600">
            This browser does not support Web Bluetooth. Try Chrome or Edge over HTTPS (or localhost).
          </p>
        )}

        {scanError && <p className="text-sm text-red-600">{scanError}</p>}
        {connectMessage && <p className="text-sm text-muted-foreground">{connectMessage}</p>}
        {statusText && !scanError && (
          <p className="text-xs text-muted-foreground">{statusText}</p>
        )}

        {/* Packets section (only when notifications are active) */}
        {validUUIDFound && (
          <div className="mt-2 text-xs text-muted-foreground">
            <div><strong>Packets received:</strong> {packetsReceived}</div>
            {lastPacketHex && <div className="mt-1 break-all"><strong>Last packet (hex):</strong> {lastPacketHex}</div>}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {supports.scanning && (
            isScanning ? (
              <Button variant="secondary" onClick={stopScan}>Stop scan</Button>
            ) : (
              <Button onClick={startScan}>Scan nearby</Button>
            )
          )}
          {supports.webBluetooth && (
            <Button variant="outline" onClick={handleChoose}>Choose device</Button>
          )}
          {connectedDevice && (
            <Button variant="ghost" onClick={disconnect}>Disconnect</Button>
          )}
        </div>

        <div className="mt-4 max-h-64 overflow-auto border rounded">
          {!hasDevices ? (
            <div className="p-3 text-sm text-muted-foreground">
              No devices yet. Click <strong>Scan nearby</strong> or <strong>Choose device</strong>.
            </div>
          ) : (
            <ul className="divide-y">
              {devices.map(d => (
                <li key={d.id} className="p-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {d.name} <span className="text-xs text-muted-foreground">({d.id})</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 space-x-3">
                      {typeof d.rssi === "number" && <span>RSSI: {d.rssi} dBm</span>}
                      {typeof d.txPower === "number" && <span>Tx: {d.txPower} dBm</span>}
                      {d.uuids?.length ? <span>UUIDs: {d.uuids.join(", ")}</span> : null}
                      <span>Last seen: {new Date(d.lastSeen).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleConnectFromList(d.id)}>
                      Connect
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}