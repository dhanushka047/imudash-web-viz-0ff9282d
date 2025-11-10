import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { StatusBar } from '@/components/StatusBar';
import { OrientationViewer } from '@/components/OrientationViewer';
import { SensorChart } from '@/components/SensorChart';
import { SettingsDialog } from '@/components/SettingsDialog';
import { BLEConnectionDialog } from '@/components/BLEConnectionDialog';
import { DataPacketStatus } from '@/components/DataPacketStatus';
import { useIMUData } from '@/hooks/useIMUData';
import { useBLE } from '@/hooks/useBLE';

const Index = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bleDialogOpen, setBleDialogOpen] = useState(false);
  const [selectedIMU, setSelectedIMU] = useState('imu1');
  const [settings, setSettings] = useState({
    samplingRate: 100,
    chartDuration: 5,
    devicePort: '/dev/ttyUSB0',
    baudRate: 115200
  });
  const [statusMessage, setStatusMessage] = useState('');
  
  const { accelerometer, gyroscope, magnetometer, rotation, clearData } = useIMUData({ isPaused });
  const bleHook = useBLE();
  
  // Track BLE data for charts
  const [bleAccelData, setBleAccelData] = useState<Array<{ time: number; x: number; y: number; z: number }>>([]);
  const [bleGyroData, setBleGyroData] = useState<Array<{ time: number; x: number; y: number; z: number }>>([]);
  const [bleMagData, setBleMagData] = useState<Array<{ time: number; x: number; y: number; z: number }>>([]);
  const [bleQuatData, setBleQuatData] = useState<Array<{ time: number; x: number; y: number; z: number; w: number }>>([]);
  const startTimeRef = useRef<number>(Date.now());

  // Update BLE data when new IMU data arrives
  useEffect(() => {
    if (bleHook.latestIMUData && !isPaused && isConnected) {
      const imuId = bleHook.latestIMUData.imuId;
      
      // Only update if it's the selected IMU
      if (imuId.toString() !== selectedIMU.replace('imu', '')) return;
      
      const currentTime = (Date.now() - startTimeRef.current) / 1000;
      const maxDataPoints = settings.samplingRate * settings.chartDuration;
      
      // Update accelerometer data
      setBleAccelData(prev => {
        const newData = [...prev, { time: currentTime, ...bleHook.latestIMUData!.accel }];
        return newData.slice(-maxDataPoints);
      });
      
      // Update gyroscope data
      setBleGyroData(prev => {
        const newData = [...prev, { time: currentTime, ...bleHook.latestIMUData!.gyro }];
        return newData.slice(-maxDataPoints);
      });
      
      // Update magnetometer data
      setBleMagData(prev => {
        const newData = [...prev, { time: currentTime, ...bleHook.latestIMUData!.mag }];
        return newData.slice(-maxDataPoints);
      });
      
      // Update quaternion data
      setBleQuatData(prev => {
        const newData = [...prev, { time: currentTime, ...bleHook.latestIMUData!.quat }];
        return newData.slice(-maxDataPoints);
      });
    }
  }, [bleHook.latestIMUData, isPaused, isConnected, settings.samplingRate, settings.chartDuration, selectedIMU]);

  const handleRecord = () => {
    setIsRecording(!isRecording);
    setStatusMessage(isRecording ? 'Recording stopped - Data saved to memory' : 'Recording started - Capturing IMU data...');
  };
  
  const handlePause = () => {
    setIsPaused(!isPaused);
    setStatusMessage(isPaused ? 'Data stream resumed - Real-time updates active' : 'Data stream paused - Updates suspended');
  };
  
  const handleClear = () => {
    clearData();
    setBleAccelData([]);
    setBleGyroData([]);
    setBleMagData([]);
    setBleQuatData([]);
    startTimeRef.current = Date.now();
    setStatusMessage('Data cleared - All chart data has been reset');
  };

  const handleExport = () => {
    setStatusMessage('Export started - Preparing CSV file for download...');
  };
  
  const handleSettings = () => {
    setSettingsOpen(true);
  };
  
  const handleConnectionClick = () => {
    if (isConnected) {
      bleHook.disconnect();
      setIsConnected(false);
      setBleAccelData([]);
      setBleGyroData([]);
      setBleMagData([]);
      setBleQuatData([]);
      startTimeRef.current = Date.now();
      setStatusMessage('Disconnected - IMU device disconnected');
    } else {
      setBleDialogOpen(true);
    }
  };
  
  const handleBLEConnect = async (deviceName: string) => {
    const device = bleHook.devices.find(d => d.name === deviceName)?.device;
    if (device) {
      const connected = await bleHook.connect(device);
      if (connected) {
        setIsConnected(true);
        setBleAccelData([]);
        setBleGyroData([]);
        setBleMagData([]);
        setBleQuatData([]);
        startTimeRef.current = Date.now();
        setStatusMessage(`Connected to ${deviceName}`);
      }
    }
  };
  
  const handleIMUChange = (imu: string) => {
    setSelectedIMU(imu);
    setStatusMessage(`IMU Changed - Switched to ${imu.toUpperCase()}`);
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header 
        isConnected={isConnected}
        isRecording={isRecording}
        isPaused={isPaused}
        selectedIMU={selectedIMU}
        onIMUChange={handleIMUChange}
        onRecord={handleRecord}
        onExport={handleExport}
        onPause={handlePause}
        onClear={handleClear}
        onSettings={handleSettings}
        onConnectionClick={handleConnectionClick}
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
      />
      
      {isConnected && bleHook.latestIMUData && (bleHook.latestIMUData.imuId.toString() === selectedIMU.replace('imu','')) && (
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
              quat: bleHook.latestIMUData.quat
            }}
          />
        </div>
      )}
      
      <main className="flex-1 p-6 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* 3D Orientation Viewer */}
          <div className="lg:col-span-1 min-h-0">
            <OrientationViewer rotation={isConnected && bleAccelData.length > 0 ? {
              x: bleGyroData[bleGyroData.length - 1]?.x || 0,
              y: bleGyroData[bleGyroData.length - 1]?.y || 0,
              z: bleGyroData[bleGyroData.length - 1]?.z || 0
            } : rotation} />
          </div>
          
          {/* Sensor Charts Grid - 4 graphs: Accel, Gyro, Mag, Fusion */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr min-h-0 overflow-auto">
            <div className="min-h-[250px]">
              <SensorChart
                title={`Accelerometer (${selectedIMU.toUpperCase()})`}
                data={isConnected ? bleAccelData : accelerometer}
                unit="m/s²"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title={`Gyroscope (${selectedIMU.toUpperCase()})`}
                data={isConnected ? bleGyroData : gyroscope}
                unit="rad/s"
                color1="hsl(var(--chart-4))"
                color2="hsl(var(--chart-5))"
                color3="hsl(var(--chart-6))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title={`Magnetometer (${selectedIMU.toUpperCase()})`}
                data={isConnected ? bleMagData : magnetometer}
                unit="µT"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Sensor Fusion (Quaternion)"
                data={isConnected && bleQuatData.length > 0 ? bleQuatData.map(q => ({
                  time: q.time,
                  x: q.x,
                  y: q.y,
                  z: q.z,
                  w: q.w
                })) : accelerometer.map((_, i) => {
                  const rx = rotation.x, ry = rotation.y, rz = rotation.z;
                  const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
                  const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
                  const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
                  const w = cx * cy * cz + sx * sy * sz;
                  const x = sx * cy * cz - cx * sy * sz;
                  const y = cx * sy * cz + sx * cy * sz;
                  const z = cx * cy * sz - sx * sy * cz;
                  return {
                    time: accelerometer[i]?.time || 0,
                    x, y, z, w
                  };
                })}
                unit="quat"
                color1="hsl(var(--chart-4))"
                color2="hsl(var(--chart-5))"
                color3="hsl(var(--chart-6))"
                showW={true}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
