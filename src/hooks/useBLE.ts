import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ---- Minimal Web Bluetooth shims ---- */
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
/* -------------------------------------- */

export type SeenDevice = {
  id: string;
  name: string;
  rssi?: number | null;
  txPower?: number | null;
  uuids?: string[];
  lastSeen: number;
  device?: BluetoothDevice;
};

export type IMUSample = {
  imuId: number;
  accel: { x: number; y: number; z: number };
  gyro: { x: number; y: number; z: number };
  mag: { x: number; y: number; z: number };
  quat: { x: number; y: number; z: number; w: number };
};

export const TARGET_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const TARGET_CHAR_NOTIFY_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const supportsWebBluetooth = () => typeof navigator !== "undefined" && !!(navigator as any).bluetooth;
const supportsScanning = () => supportsWebBluetooth() && typeof (navigator as any).bluetooth.requestLEScan === "function";

export function useBLE() {
  const [devices, setDevices] = useState<Record<string, SeenDevice>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);

  const [validUUIDFound, setValidUUIDFound] = useState(false);
  const [packetsReceived, setPacketsReceived] = useState(0);
  const [lastPacketHex, setLastPacketHex] = useState<string | null>(null);

  // latest sample for *any* IMU (last one in last packet)
  const [latestIMUData, setLatestIMUData] = useState<IMUSample | null>(null);
  // latest samples per IMU id (0..5)
  const [latestByIMU, setLatestByIMU] = useState<Record<number, IMUSample>>({});

  const advHandlerRef = useRef<(ev: any) => void>();
  const leScanRef = useRef<BluetoothLEScan | null>(null);
  const notifyCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const addOrUpdate = useCallback((d: Partial<SeenDevice> & { id: string }) => {
    setDevices((prev) => {
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
    return list.sort((a, b) => b.lastSeen - a.lastSeen);
  }, [devices]);

  const hasDevices = Object.keys(devices).length > 0;

  const startScan = useCallback(async () => {
    setScanError(null);
    if (!supportsScanning()) {
      setScanError("BLE scanning not supported.");
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
          const id: string = event?.device?.id ?? crypto.randomUUID();
          const name: string = event?.device?.name ?? "Unknown";
          const rssi: number | undefined = event?.rssi;
          const txPower: number | undefined = event?.txPower;
          addOrUpdate({ id, name, rssi, txPower, lastSeen: Date.now(), device: event?.device });
        } catch {}
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
    } catch {}
    setIsScanning(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const chooseDevice = useCallback(async () => {
    setScanError(null);
    if (!supportsWebBluetooth()) {
      setScanError("Browser doesn't support Web Bluetooth.");
      return null;
    }
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: "W" }],
        optionalServices: [TARGET_SERVICE_UUID],
      });
      if (!device) return null;
      addOrUpdate({ id: device.id, name: device.name ?? "Unknown", lastSeen: Date.now(), device });
      return device as BluetoothDevice;
    } catch (e: any) {
      if (e?.name === "NotFoundError") return null;
      setScanError(e?.message ?? String(e));
      return null;
    }
  }, [addOrUpdate]);

  // Notification handler: can contain multiple IMUs: [id0,ax0,...,w0, id1,ax1,...,w1, ...]
  const onNotify = (ev: Event) => {
    const ch = ev.target as BluetoothRemoteGATTCharacteristic;
    const dv = ch?.value;
    if (!dv) return;

    const decoder = new TextDecoder();
    const text = decoder.decode(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
    const values = text
      .trim()
      .split(",")
      .map((v) => parseFloat(v));

    const samples: IMUSample[] = [];

    const GROUP = 14; // id + 13 values
    for (let i = 0; i + GROUP - 1 < values.length; i += GROUP) {
      const imuId = values[i];
      if (Number.isNaN(imuId)) continue;
      samples.push({
        imuId,
        accel: { x: values[i + 1], y: values[i + 2], z: values[i + 3] },
        gyro: { x: values[i + 4], y: values[i + 5], z: values[i + 6] },
        mag: { x: values[i + 7], y: values[i + 8], z: values[i + 9] },
        quat: {
          x: values[i + 10],
          y: values[i + 11],
          z: values[i + 12],
          w: values[i + 13],
        },
      });
    }

    if (samples.length > 0) {
      const lastSample = samples[samples.length - 1];
      setLatestIMUData(lastSample);
      setLatestByIMU((prev) => {
        const next = { ...prev };
        for (const s of samples) {
          next[s.imuId] = s;
        }
        return next;
      });
    }

    const bytes = Array.from(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
    const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
    setLastPacketHex(hex);
    setPacketsReceived((prev) => prev + 1);
  };


  

  const disconnect = useCallback(() => {
    try {
      notifyCharRef.current?.removeEventListener("characteristicvaluechanged", onNotify);
      notifyCharRef.current = null;
    } catch {}
    try {
      connectedDevice?.gatt?.disconnect();
    } catch {}
    setConnectedDevice(null);
    setValidUUIDFound(false);
    setConnectMessage("Disconnected");
  }, [connectedDevice]);

  const connect = useCallback(
    async (device: BluetoothDevice) => {
      setConnectMessage("Connecting…");
      setPacketsReceived(0);
      setLastPacketHex(null);
      setValidUUIDFound(false);
      setLatestIMUData(null);
      setLatestByIMU({});

      try {
        const server = await device.gatt?.connect();
        if (!server) {
          setConnectMessage("Failed to connect");
          return false;
        }
        setConnectedDevice(device);

        const service = await server.getPrimaryService(TARGET_SERVICE_UUID);
        const notifyChar = await service.getCharacteristic(TARGET_CHAR_NOTIFY_UUID);

        await notifyChar.startNotifications();
        notifyChar.addEventListener("characteristicvaluechanged", onNotify);
        notifyCharRef.current = notifyChar;

        setValidUUIDFound(true);
        setConnectMessage("Receiving notifications…");
        return true;
      } catch (e: any) {
        setConnectMessage(e?.message ?? "Connection error");
        disconnect();
        return false;
      }
    },
    [disconnect]
  );

  const supports = useMemo(
    () => ({ webBluetooth: supportsWebBluetooth(), scanning: supportsScanning() }),
    []
  );

  const statusText = useMemo(() => {
    if (scanError) return null;
    if (isScanning && !hasDevices) return "Scanning for BLE devices…";
    if (isScanning && hasDevices) return `Found ${Object.keys(devices).length} device(s)`;
    if (!isScanning && !hasDevices) return "No BLE devices found.";
    return `Found ${Object.keys(devices).length} device(s)`;
  }, [isScanning, hasDevices, devices, scanError]);

  return {
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
    latestIMUData,
    latestByIMU,          // 👈 per-IMU latest samples

    startScan,
    stopScan,
    chooseDevice,
    connect,
    disconnect,
  };
}