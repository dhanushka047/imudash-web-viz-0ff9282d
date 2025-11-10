import React from "react";
import type { useBLE } from "@/hooks/useBLE";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type BLECtx = ReturnType<typeof useBLE>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnect: (deviceName: string) => void;
  ble: BLECtx;
};

export function BLEConnectionDialog({ open, onOpenChange, onConnect, ble }: Props) {
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
  } = ble;

  const handleChoose = async () => {
    const device = await chooseDevice();
    if (device) {
      const ok = await connect(device);
      if (ok) onConnect(device.name ?? "Unknown");
    }
  };

  const handleConnectFromList = async (id: string) => {
    const d = devices.find((x) => x.id === id)?.device;
    if (d) {
      const ok = await connect(d);
      if (ok) onConnect(d.name ?? "Unknown");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Connect to a BLE Device</DialogTitle>
          <DialogDescription>
            Validate BLE service and characteristic, then receive live packets.
          </DialogDescription>
        </DialogHeader>

        {scanError && <p className="text-sm text-red-600">{scanError}</p>}
        {connectMessage && <p className="text-sm">{connectMessage}</p>}
        {statusText && <p className="text-xs text-muted-foreground">{statusText}</p>}

        {validUUIDFound && (
          <div className="mt-2 text-xs text-muted-foreground">
            <div><strong>Packets received:</strong> {packetsReceived}</div>
            {lastPacketHex && <div className="break-all"><strong>Last packet:</strong> {lastPacketHex}</div>}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {isScanning ? (
            <Button variant="secondary" onClick={stopScan}>Stop scan</Button>
          ) : (
            <Button onClick={startScan}>Scan nearby</Button>
          )}
          <Button variant="outline" onClick={handleChoose}>Choose device</Button>
          {connectedDevice && <Button variant="ghost" onClick={disconnect}>Disconnect</Button>}
        </div>

        <div className="mt-4 max-h-64 overflow-auto border rounded">
          {!hasDevices ? (
            <div className="p-3 text-sm text-muted-foreground">No devices. Click Scan or Choose.</div>
          ) : (
            <ul className="divide-y">
              {devices.map((d) => (
                <li key={d.id} className="p-3 flex justify-between">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(d.lastSeen).toLocaleTimeString()}</div>
                  </div>
                  <Button size="sm" onClick={() => handleConnectFromList(d.id)}>Connect</Button>
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