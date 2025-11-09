import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { StatusBar } from '@/components/StatusBar';
import { OrientationViewer } from '@/components/OrientationViewer';
import { SensorChart } from '@/components/SensorChart';
import { SettingsDialog } from '@/components/SettingsDialog';
import { BLEConnectionDialog } from '@/components/BLEConnectionDialog';
import { DataPacketStatus } from '@/components/DataPacketStatus';
import { useIMUData } from '@/hooks/useIMUData';

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
  const [packetsReceived, setPacketsReceived] = useState(0);
  const [dataRate, setDataRate] = useState(0);
  const [lastPacketTime, setLastPacketTime] = useState('--:--:--');
  const [statusMessage, setStatusMessage] = useState('');
  
  const { accelerometer, gyroscope, magnetometer, rotation, clearData } = useIMUData({ isPaused });

  // Simulate packet reception tracking
  useEffect(() => {
    if (!isPaused && isConnected) {
      const interval = setInterval(() => {
        setPacketsReceived(prev => prev + 1);
        setDataRate(settings.samplingRate);
        const now = new Date();
        setLastPacketTime(now.toLocaleTimeString());
      }, 1000 / settings.samplingRate);
      
      return () => clearInterval(interval);
    }
  }, [isPaused, isConnected, settings.samplingRate]);

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
    setPacketsReceived(0);
    setDataRate(0);
    setLastPacketTime('--:--:--');
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
      setIsConnected(false);
      setStatusMessage('Disconnected - IMU device disconnected');
    } else {
      setBleDialogOpen(true);
    }
  };
  
  const handleBLEConnect = (deviceName: string) => {
    setIsConnected(true);
    setStatusMessage(`Connected to ${deviceName}`);
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
      
      {isConnected && (
        <div className="px-6 pt-4">
          <DataPacketStatus
            packetsReceived={packetsReceived}
            dataRate={dataRate}
            lastPacketTime={lastPacketTime}
            latestData={{
              accel: {
                x: accelerometer[accelerometer.length - 1]?.x || 0,
                y: accelerometer[accelerometer.length - 1]?.y || 0,
                z: accelerometer[accelerometer.length - 1]?.z || 0
              },
              gyro: {
                x: gyroscope[gyroscope.length - 1]?.x || 0,
                y: gyroscope[gyroscope.length - 1]?.y || 0,
                z: gyroscope[gyroscope.length - 1]?.z || 0
              }
            }}
          />
        </div>
      )}
      
      <main className="flex-1 p-6 overflow-hidden min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* 3D Orientation Viewer */}
          <div className="lg:col-span-1 min-h-0">
            <OrientationViewer rotation={rotation} />
          </div>
          
          {/* Sensor Charts Grid - 4 graphs: Accel, Gyro, Mag, Fusion */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr min-h-0 overflow-auto">
            <div className="min-h-[250px]">
              <SensorChart
                title={`Accelerometer (${selectedIMU.toUpperCase()})`}
                data={accelerometer}
                unit="m/s²"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title={`Gyroscope (${selectedIMU.toUpperCase()})`}
                data={gyroscope}
                unit="rad/s"
                color1="hsl(var(--chart-4))"
                color2="hsl(var(--chart-5))"
                color3="hsl(var(--chart-6))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title={`Magnetometer (${selectedIMU.toUpperCase()})`}
                data={magnetometer}
                unit="µT"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Sensor Fusion (Orientation)"
                data={accelerometer.map((_, i) => ({
                  time: accelerometer[i]?.time || 0,
                  x: rotation.x % (2 * Math.PI),
                  y: rotation.y % (2 * Math.PI),
                  z: rotation.z % (2 * Math.PI)
                }))}
                unit="rad"
                color1="hsl(var(--chart-4))"
                color2="hsl(var(--chart-5))"
                color3="hsl(var(--chart-6))"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
