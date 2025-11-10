import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { StatusBar } from "@/components/StatusBar";
import { OrientationViewer } from "@/components/OrientationViewer";
import { SensorChart } from "@/components/SensorChart";
import { SettingsDialog } from "@/components/SettingsDialog";
import { BLEConnectionDialog } from "@/components/BLEConnectionDialog";
import { DataPacketStatus } from "@/components/DataPacketStatus";
import { useIMUData } from "@/hooks/useIMUData";
import { useBLE } from "@/hooks/useBLE";

export default function Index() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bleDialogOpen, setBleDialogOpen] = useState(false);
  const [selectedIMU, setSelectedIMU] = useState("imu1");
  const [statusMessage, setStatusMessage] = useState("");

  // ✅ Default chart settings
  const [settings, setSettings] = useState({
    samplingRate: 100,
    chartDuration: 5,
    devicePort: "/dev/ttyUSB0",
    baudRate: 115200,
  });

  const bleHook = useBLE();
  const { clearData } = useIMUData({ isPaused: !isConnected || isPaused });

  const [bleAccelData, setBleAccelData] = useState<any[]>([]);
  const [bleGyroData, setBleGyroData] = useState<any[]>([]);
  const [bleMagData, setBleMagData] = useState<any[]>([]);
  const [bleQuatData, setBleQuatData] = useState<any[]>([]);
  const startTimeRef = useRef(Date.now());

  // ✅ Update graphs when new IMU packet arrives
  useEffect(() => {
    const imu = bleHook.latestIMUData;
    if (!imu || !isConnected || isPaused) return;

    const currentTime = (Date.now() - startTimeRef.current) / 1000;
    const maxPoints = settings.samplingRate * settings.chartDuration;

    setBleAccelData((prev) =>
      [...prev, { time: currentTime, ...imu.accel }].slice(-maxPoints)
    );
    setBleGyroData((prev) =>
      [...prev, { time: currentTime, ...imu.gyro }].slice(-maxPoints)
    );
    setBleMagData((prev) =>
      [...prev, { time: currentTime, ...imu.mag }].slice(-maxPoints)
    );
    setBleQuatData((prev) =>
      [...prev, { time: currentTime, ...imu.quat }].slice(-maxPoints)
    );
  }, [bleHook.latestIMUData, isConnected, isPaused, settings]);

  // ✅ After connection established
  const handleBLEConnect = (deviceName: string) => {
    setIsConnected(true);
    setStatusMessage(`Connected to ${deviceName}`);
    startTimeRef.current = Date.now();
    setBleAccelData([]);
    setBleGyroData([]);
    setBleMagData([]);
    setBleQuatData([]);
  };

  const handleDisconnect = () => {
    bleHook.disconnect();
    setIsConnected(false);
    setStatusMessage("Disconnected");
    setBleAccelData([]);
    setBleGyroData([]);
    setBleMagData([]);
    setBleQuatData([]);
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header
        isConnected={isConnected}
        isRecording={isRecording}
        isPaused={isPaused}
        selectedIMU={selectedIMU}
        onIMUChange={setSelectedIMU}
        onRecord={() => setIsRecording(!isRecording)}
        onExport={() => {}}
        onPause={() => setIsPaused(!isPaused)}
        onClear={() => {
          clearData();
          setBleAccelData([]);
          setBleGyroData([]);
          setBleMagData([]);
          setBleQuatData([]);
        }}
        onSettings={() => setSettingsOpen(true)}
        onConnectionClick={() =>
          isConnected ? handleDisconnect() : setBleDialogOpen(true)
        }
      />

      <StatusBar message={statusMessage} />

      {/* ✅ Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />

      {/* ✅ BLE Connection Dialog */}
      <BLEConnectionDialog
        open={bleDialogOpen}
        onOpenChange={setBleDialogOpen}
        onConnect={handleBLEConnect}
        ble={bleHook}
      />

      {/* ✅ Data Status */}
      {isConnected && bleHook.latestIMUData && (
        <div className="px-6 pt-4">
          <DataPacketStatus
            packetsReceived={bleHook.packetsReceived}
            dataRate={settings.samplingRate}
            lastPacketTime={new Date().toLocaleTimeString()}
            imuId={bleHook.latestIMUData.imuId}
            latestData={{
              accel: bleHook.latestIMUData.accel,
              gyro: bleHook.latestIMUData.gyro,
              mag: bleHook.latestIMUData.mag,
              quat: bleHook.latestIMUData.quat,
            }}
          />
        </div>
      )}

      {/* ✅ Main Charts */}
      <main className="flex-1 p-6 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* 3D Viewer */}
          <div className="lg:col-span-1 min-h-0">
            {isConnected && bleGyroData.length > 0 ? (
              <OrientationViewer
                rotation={{
                  x: bleGyroData.at(-1)?.x || 0,
                  y: bleGyroData.at(-1)?.y || 0,
                  z: bleGyroData.at(-1)?.z || 0,
                }}
              />
            ) : (
              <div className="bg-card rounded-lg border h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-muted-foreground">3D Orientation</p>
                  <p className="text-muted-foreground/60 text-sm mt-2">
                    Connect device to view
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Sensor Charts */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr min-h-0 overflow-auto">
            {isConnected ? (
              <>
                <SensorChart
                  title={`Accelerometer (${selectedIMU.toUpperCase()})`}
                  data={bleAccelData}
                  unit="m/s²"
                />
                <SensorChart
                  title={`Gyroscope (${selectedIMU.toUpperCase()})`}
                  data={bleGyroData}
                  unit="rad/s"
                />
                <SensorChart
                  title={`Magnetometer (${selectedIMU.toUpperCase()})`}
                  data={bleMagData}
                  unit="µT"
                />
                <SensorChart
                  title="Quaternion"
                  data={bleQuatData}
                  unit="quat"
                  showW
                />
              </>
            ) : (
              <div className="col-span-2 flex items-center justify-center min-h-[500px]">
                <div className="text-center">
                  <p className="text-muted-foreground text-lg">
                    No device connected
                  </p>
                  <p className="text-muted-foreground/60 text-sm mt-2">
                    Connect to an IMU device to view sensor data
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}