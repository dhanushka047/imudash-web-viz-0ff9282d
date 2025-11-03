import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ---- Minimal Web Bluetooth shims (safe augmentations) ---- */
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
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    uuid: string;
    value?: DataView | null;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(type: "characteristicvaluechanged", listener: (this: this, ev: Event) => any): void;
    removeEventListener(type: "characteristicvaluechanged", listener: (this: this, ev: Event) => any): void;
  }

  interface BluetoothLEScan {
    active?: boolean;
    keepRepeatedDevices?: boolean;
    acceptAllAdvertisements?: boolean;
    stop(): void;
  }

  type BluetoothServiceUUID = number | string;
  type BluetoothCharacteristicUUID = number | string;
}
/* ---------------------------------------------------------- */

export type SeenDevice = {
  id: string;
  name: string;
  rssi?: number | null;
  txPower?: number | null;
  uuids?: string[];
  lastSeen: number;
  device?: BluetoothDevice;
};

/** Target UUIDs (Nordic UART style) */
/** Target UUIDs (Nordic UART style) */
export const TARGET_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const TARGET_CHAR_NOTIFY_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const supportsWebBluetooth = () =>
  typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

const supportsScanning = () =>
  supportsWebBluetooth() &&
  typeof (navigator as any).bluetooth.requestLEScan === "function";

export function useBLE() {
  const [devices, setDevices] = useState<Record<string, SeenDevice>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);

  // Data/notify state
  const [validUUIDFound, setValidUUIDFound] = useState(false);
  const [packetsReceived, setPacketsReceived] = useState(0);
  const [lastPacketHex, setLastPacketHex] = useState<string | null>(null);

  const advHandlerRef = useRef<(ev: any) => void>();
  const leScanRef = useRef<BluetoothLEScan | null>(null);
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

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

  const sortedDevices = useMemo(() => {
    const list = Object.values(devices);
    return list.sort((a, b) => {
      if (b.lastSeen !== a.lastSeen) return b.lastSeen - a.lastSeen;
      const rssiA = a.rssi ?? -999, rssiB = b.rssi ?? -999;
      if (rssiB !== rssiA) return rssiB - rssiA;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [devices]);

  const hasDevices = Object.keys(devices).length > 0;

  const startScan = useCallback(async () => {
    setScanError(null);
    if (!supportsScanning()) {
      setScanError("BLE scanning not supported. Use the device picker instead.");
      return;
    }
    try {
      const scan = await (navigator as any).bluetooth.requestLEScan({
        keepRepeatedDevices: true,
        acceptAllAdvertisements: true,
      });
      leScanRef.current = scan;
      setIsScanning(true);

      const onAdv = (event: any) => {
        try {
          const id: string = event?.device?.id ?? event?.uuid ?? crypto.randomUUID();
          const name: string = event?.device?.name ?? event?.name ?? "Unknown";
          const rssi: number | undefined = event?.rssi;
          const txPower: number | undefined = event?.txPower;
          const uuids: string[] | undefined = event?.uuids;
          addOrUpdate({
            id, name, rssi, txPower, uuids, lastSeen: Date.now(), device: event?.device,
          });
        } catch { /* ignore */ }
      };

      advHandlerRef.current = onAdv;
      (navigator as any).bluetooth.addEventListener("advertisementreceived", onAdv);
    } catch (e: any) {
      setScanError(e?.message ?? String(e));
    }
  }, [addOrUpdate]);

  const stopScan = useCallback(() => {
    try {
      if (advHandlerRef.current) {
        (navigator as any).bluetooth.removeEventListener("advertisementreceived", advHandlerRef.current);
        advHandlerRef.current = undefined;
      }
      leScanRef.current?.stop?.();
    } catch { /* ignore */ }
    setIsScanning(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

const chooseDevice = useCallback(async () => {
  setScanError(null);
  if (!supportsWebBluetooth()) {
    setScanError("This browser doesn't support Web Bluetooth.");
    return null;
  }
  try {
    // 🔹 Only show devices whose name starts with "S"
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ namePrefix: "S" }],
      optionalServices: [TARGET_SERVICE_UUID],
    });

    if (!device) return null;

    addOrUpdate({
      id: device.id,
      name: device.name ?? "Unknown",
      lastSeen: Date.now(),
      device,
    });

    return device as BluetoothDevice;
  } catch (e: any) {
    if (e?.name === "NotFoundError") return null; // user cancelled picker
    setScanError(e?.message ?? String(e));
    return null;
  }
}, [addOrUpdate]);

  const disconnect = useCallback(() => {
    try {
      notifyCharRef.current?.removeEventListener("characteristicvaluechanged", onNotify);
      notifyCharRef.current = null;
    } catch {}
    try {
      connectedDevice?.gatt?.disconnect();
    } catch { /* ignore */ }
    setConnectedDevice(null);
    setValidUUIDFound(false);
    setConnectMessage("Disconnected");
  }, [connectedDevice]);

  // Bound in closure; declared here so TS is happy
  const onNotify = (ev: Event) => {
    const ch = ev.target as BluetoothRemoteGATTCharacteristic;
    const dv = ch?.value;
    if (!dv) return;
    // Convert to hex preview (first up to 16 bytes)
    const bytes = Array.from(new Uint8Array(dv.buffer));
    const hex = bytes.slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join(" ");
    setLastPacketHex(hex);
    setPacketsReceived(prev => prev + 1);
  };





  

  const connect = useCallback(async (device: BluetoothDevice) => {
    setConnectMessage("Connecting…");
    setPacketsReceived(0);
    setLastPacketHex(null);
    setValidUUIDFound(false);

    try {
      const server = await device.gatt?.connect();
      if (!server) {
        setConnectMessage("Failed to connect");
        return false;
      }
      setConnectedDevice(device);

      // Try to find the target service & characteristic
      setConnectMessage("Discovering services…");
      let service: BluetoothRemoteGATTService | null = null;
      try {
        service = await server.getPrimaryService(TARGET_SERVICE_UUID);
      } catch {
        // service not found
      }

      if (!service) {
        setConnectMessage("Not found valid UUID (service). Disconnecting…");
        disconnect();
        return false;
      }

      setConnectMessage("Finding notify characteristic…");
      let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
      try {
        notifyChar = await service.getCharacteristic(TARGET_CHAR_NOTIFY_UUID);
      } catch {
        // char not found
      }

      if (!notifyChar) {
        setConnectMessage("Not found valid UUID (characteristic). Disconnecting…");
        disconnect();
        return false;
      }

      // Start notifications
      await notifyChar.startNotifications();
      notifyChar.addEventListener("characteristicvaluechanged", onNotify);
      notifyCharRef.current = notifyChar;
      setValidUUIDFound(true);
      setConnectMessage("Receiving notifications…");
      return true;
    } catch (e: any) {
      setConnectMessage(e?.message ?? "Connection error");
      try { disconnect(); } catch {}
      return false;
    }
  }, [disconnect]);

  const supports = useMemo(() => ({
    webBluetooth: supportsWebBluetooth(),
    scanning: supportsScanning(),
  }), []);

  const statusText = useMemo(() => {
    if (scanError) return null;
    if (isScanning && !hasDevices) return "Scanning for BLE devices…";
    if (isScanning && hasDevices) return `Found ${Object.keys(devices).length} device(s)`;
    if (!isScanning && !hasDevices) return "No BLE devices found.";
    return `Found ${Object.keys(devices).length} device(s)`;
  }, [isScanning, hasDevices, devices, scanError]);

  return {
    // state
    devices: sortedDevices,
    hasDevices,
    isScanning,
    scanError,
    connectMessage,
    connectedDevice,
    statusText,
    supports,
    validUUIDFound,
    packetsReceived,
    lastPacketHex,

    // actions
    startScan,
    stopScan,
    chooseDevice,
    connect,
    disconnect,
  };
}