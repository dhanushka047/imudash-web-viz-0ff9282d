// pages/index.tsx
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

  // default IMU is firmware ID 0 => "imu0"
  const [selectedIMU, setSelectedIMU] = useState("imu0");
  const [statusMessage, setStatusMessage] = useState("");

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

  // update charts with packets for the selected IMU only
  useEffect(() => {
    const imu = bleHook.latestIMUData;
    if (!imu || !isConnected || isPaused) return;

    const currentImuKey = `imu${imu.imuId}`; // imuId 0..5 -> "imu0".. "imu5"
    if (currentImuKey !== selectedIMU) return;

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
  }, [bleHook.latestIMUData, isConnected, isPaused, selectedIMU, settings]);

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

  const handleIMUChange = (imu: string) => {
    setSelectedIMU(imu);
    setStatusMessage(`IMU Changed - Switched to ${imu.toUpperCase()}`);
    startTimeRef.current = Date.now();
    setBleAccelData([]);
    setBleGyroData([]);
    setBleMagData([]);
    setBleQuatData([]);
  };

  const handleClear = () => {
    clearData();
    setBleAccelData([]);
    setBleGyroData([]);
    setBleMagData([]);
    setBleQuatData([]);
    startTimeRef.current = Date.now();
    setStatusMessage("Data cleared - All chart data has been reset");
  };

  const selectedLatestIMU =
    bleHook.latestIMUData &&
    `imu${bleHook.latestIMUData.imuId}` === selectedIMU
      ? bleHook.latestIMUData
      : null;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header
        isConnected={isConnected}
        isRecording={isRecording}
        isPaused={isPaused}
        selectedIMU={selectedIMU}
        onIMUChange={handleIMUChange}
        onRecord={() => {
          setIsRecording((prev) => !prev);
          setStatusMessage(
            !isRecording
              ? "Recording started - Capturing IMU data..."
              : "Recording stopped - Data saved"
          );
        }}
        onExport={() => {
          setStatusMessage("Export started - Preparing CSV...");
        }}
        onPause={() => {
          setIsPaused((prev) => !prev);
          setStatusMessage(
            !isPaused
              ? "Data stream paused - Updates suspended"
              : "Data stream resumed - Real-time updates active"
          );
        }}
        onClear={handleClear}
        onSettings={() => setSettingsOpen(true)}
        onConnectionClick={() =>
          isConnected ? handleDisconnect() : setBleDialogOpen(true)
        }
      />

      <StatusBar message={statusMessage} />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />

      <BLEConnectionDialog
        open={bleDialogOpen}
        onOpenChange={setBleDialogOpen}
        onConnect={handleBLEConnect}
        ble={bleHook}
      />

      {isConnected && selectedLatestIMU && (
        <div className="px-6 pt-4">
          <DataPacketStatus
            packetsReceived={bleHook.packetsReceived}
            dataRate={settings.samplingRate}
            lastPacketTime={new Date().toLocaleTimeString()}
            imuId={selectedLatestIMU.imuId}
            latestData={{
              accel: selectedLatestIMU.accel,
              gyro: selectedLatestIMU.gyro,
              mag: selectedLatestIMU.mag,
              quat: selectedLatestIMU.quat,
            }}
          />
        </div>
      )}

      <main className="flex-1 p-6 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          <div className="lg:col-span-1 min-h-0">
            {isConnected && bleGyroData.length > 0 ? (
              <OrientationViewer
                rotation={{
                  x: bleGyroData[bleGyroData.length - 1]?.x || 0,
                  y: bleGyroData[bleGyroData.length - 1]?.y || 0,
                  z: bleGyroData[bleGyroData.length - 1]?.z || 0,
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

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr min-h-0 overflow-auto">
            {isConnected ? (
              <>
                <div className="min-h-[250px]">
                  <SensorChart
                    title={`Accelerometer (${selectedIMU.toUpperCase()})`}
                    data={bleAccelData}
                    unit="m/s²"
                  />
                </div>

                <div className="min-h-[250px]">
                  <SensorChart
                    title={`Gyroscope (${selectedIMU.toUpperCase()})`}
                    data={bleGyroData}
                    unit="rad/s"
                  />
                </div>

                <div className="min-h-[250px]">
                  <SensorChart
                    title={`Magnetometer (${selectedIMU.toUpperCase()})`}
                    data={bleMagData}
                    unit="µT"
                  />
                </div>

                <div className="min-h-[250px]">
                  <SensorChart
                    title="Quaternion"
                    data={bleQuatData}
                    unit="quat"
                    showW
                  />
                </div>
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