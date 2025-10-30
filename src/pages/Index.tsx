import { useState } from 'react';
import { Header } from '@/components/Header';
import { OrientationViewer } from '@/components/OrientationViewer';
import { SensorChart } from '@/components/SensorChart';
import { SettingsDialog } from '@/components/SettingsDialog';
import { useIMUData } from '@/hooks/useIMUData';
import { toast } from 'sonner';

const Index = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    samplingRate: 100,
    chartDuration: 5,
    devicePort: '/dev/ttyUSB0',
    baudRate: 115200
  });
  
  const { accelerometer, gyroscope, magnetometer, rotation, clearData } = useIMUData({ isPaused });

  const handleRecord = () => {
    setIsRecording(!isRecording);
    toast(isRecording ? 'Recording stopped' : 'Recording started', {
      description: isRecording ? 'Data saved to memory' : 'Capturing IMU data...'
    });
  };
  
  const handlePause = () => {
    setIsPaused(!isPaused);
    toast(isPaused ? 'Data stream resumed' : 'Data stream paused', {
      description: isPaused ? 'Real-time updates active' : 'Updates suspended'
    });
  };
  
  const handleClear = () => {
    clearData();
    toast('Data cleared', {
      description: 'All chart data has been reset'
    });
  };

  const handleExport = () => {
    toast('Export started', {
      description: 'Preparing CSV file for download...'
    });
  };
  
  const handleSettings = () => {
    setSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header 
        isConnected={isConnected}
        isRecording={isRecording}
        isPaused={isPaused}
        onRecord={handleRecord}
        onExport={handleExport}
        onPause={handlePause}
        onClear={handleClear}
        onSettings={handleSettings}
      />
      
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSettingsChange={setSettings}
      />
      
      <main className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-h-[calc(100vh-120px)]">
          {/* 3D Orientation Viewer */}
          <div className="lg:col-span-1 h-[500px] lg:h-full min-h-[400px]">
            <OrientationViewer rotation={rotation} />
          </div>
          
          {/* Sensor Charts Grid */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 grid-rows-3 min-h-0 overflow-auto">
            <div className="min-h-[250px]">
              <SensorChart
                title="Accelerometer"
                data={accelerometer}
                unit="m/s²"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Gyroscope"
                data={gyroscope}
                unit="rad/s"
                color1="hsl(var(--chart-4))"
                color2="hsl(var(--chart-5))"
                color3="hsl(var(--chart-6))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Magnetometer"
                data={magnetometer}
                unit="µT"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Orientation (Euler)"
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
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Linear Acceleration"
                data={accelerometer.map(d => ({
                  time: d.time,
                  x: d.x,
                  y: d.y,
                  z: d.z - 9.8
                }))}
                unit="m/s²"
                color1="hsl(var(--chart-1))"
                color2="hsl(var(--chart-2))"
                color3="hsl(var(--chart-3))"
              />
            </div>
            
            <div className="min-h-[250px]">
              <SensorChart
                title="Angular Velocity"
                data={gyroscope}
                unit="°/s"
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
