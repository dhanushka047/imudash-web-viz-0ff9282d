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
  const [selectedIMUs, setSelectedIMUs] = useState<number[]>([1]);
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
  
  const { imuData, clearData } = useIMUData({ isPaused, selectedIMUs });

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
  
  const handleIMUToggle = (imu: number) => {
    setSelectedIMUs(prev => {
      if (prev.includes(imu)) {
        const newSelection = prev.filter(i => i !== imu);
        setStatusMessage(newSelection.length === 0 ? 'All IMUs deselected' : `IMU ${imu} deselected`);
        return newSelection;
      } else {
        setStatusMessage(`IMU ${imu} selected`);
        return [...prev, imu].sort();
      }
    });
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Header 
        isConnected={isConnected}
        isRecording={isRecording}
        isPaused={isPaused}
        selectedIMUs={selectedIMUs}
        onIMUToggle={handleIMUToggle}
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
      
      {isConnected && selectedIMUs.length > 0 && (
        <div className="px-6 pt-4">
          <DataPacketStatus
            packetsReceived={packetsReceived}
            dataRate={dataRate}
            lastPacketTime={lastPacketTime}
            latestData={{
              accel: {
                x: imuData[selectedIMUs[0]]?.accelerometer[imuData[selectedIMUs[0]].accelerometer.length - 1]?.x || 0,
                y: imuData[selectedIMUs[0]]?.accelerometer[imuData[selectedIMUs[0]].accelerometer.length - 1]?.y || 0,
                z: imuData[selectedIMUs[0]]?.accelerometer[imuData[selectedIMUs[0]].accelerometer.length - 1]?.z || 0
              },
              gyro: {
                x: imuData[selectedIMUs[0]]?.gyroscope[imuData[selectedIMUs[0]].gyroscope.length - 1]?.x || 0,
                y: imuData[selectedIMUs[0]]?.gyroscope[imuData[selectedIMUs[0]].gyroscope.length - 1]?.y || 0,
                z: imuData[selectedIMUs[0]]?.gyroscope[imuData[selectedIMUs[0]].gyroscope.length - 1]?.z || 0
              }
            }}
          />
        </div>
      )}
      
      <main className="flex-1 p-6 overflow-hidden min-h-0">
        <div className="flex flex-col gap-6 h-full">
          {/* 3D Orientation Viewers */}
          {selectedIMUs.length > 0 && (
            <div className={`grid gap-4 ${selectedIMUs.length === 1 ? 'grid-cols-1' : selectedIMUs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {selectedIMUs.map(imuIndex => (
                <div key={imuIndex} className="min-h-[300px]">
                  <OrientationViewer 
                    rotation={imuData[imuIndex]?.rotation || { x: 0, y: 0, z: 0 }} 
                  />
                  <p className="text-center text-sm text-muted-foreground mt-2">IMU {imuIndex}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* Sensor Charts Grid - 4 graphs for first selected IMU */}
          {selectedIMUs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr min-h-0 overflow-auto flex-1">
              <div className="min-h-[250px]">
                <SensorChart
                  title={`Accelerometer (IMU ${selectedIMUs[0]})`}
                  data={imuData[selectedIMUs[0]]?.accelerometer || []}
                  unit="m/s²"
                  color1="hsl(var(--chart-1))"
                  color2="hsl(var(--chart-2))"
                  color3="hsl(var(--chart-3))"
                />
              </div>
              
              <div className="min-h-[250px]">
                <SensorChart
                  title={`Gyroscope (IMU ${selectedIMUs[0]})`}
                  data={imuData[selectedIMUs[0]]?.gyroscope || []}
                  unit="rad/s"
                  color1="hsl(var(--chart-4))"
                  color2="hsl(var(--chart-5))"
                  color3="hsl(var(--chart-6))"
                />
              </div>
              
              <div className="min-h-[250px]">
                <SensorChart
                  title={`Magnetometer (IMU ${selectedIMUs[0]})`}
                  data={imuData[selectedIMUs[0]]?.magnetometer || []}
                  unit="µT"
                  color1="hsl(var(--chart-1))"
                  color2="hsl(var(--chart-2))"
                  color3="hsl(var(--chart-3))"
                />
              </div>
              
              <div className="min-h-[250px]">
                <SensorChart
                  title="Sensor Fusion (Orientation)"
                  data={(imuData[selectedIMUs[0]]?.accelerometer || []).map((_, i) => ({
                    time: imuData[selectedIMUs[0]]?.accelerometer[i]?.time || 0,
                    x: (imuData[selectedIMUs[0]]?.rotation.x || 0) % (2 * Math.PI),
                    y: (imuData[selectedIMUs[0]]?.rotation.y || 0) % (2 * Math.PI),
                    z: (imuData[selectedIMUs[0]]?.rotation.z || 0) % (2 * Math.PI)
                  }))}
                  unit="rad"
                  color1="hsl(var(--chart-4))"
                  color2="hsl(var(--chart-5))"
                  color3="hsl(var(--chart-6))"
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
