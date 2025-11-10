import { Card } from "@/components/ui/card";
import { Activity, Clock, Database } from "lucide-react";

interface DataPacketStatusProps {
  packetsReceived: number;
  dataRate: number;
  lastPacketTime: string;
  imuId: number;
  latestData: {
    accel: { x: number; y: number; z: number };
    gyro: { x: number; y: number; z: number };
    mag: { x: number; y: number; z: number };
    quat: { x: number; y: number; z: number; w: number };
  };
}

export const DataPacketStatus = ({ 
  packetsReceived, 
  dataRate, 
  lastPacketTime,
  imuId,
  latestData 
}: DataPacketStatusProps) => {
  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm px-4 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">IMU {imuId}:</span>
            <span className="font-mono font-semibold text-foreground">{packetsReceived} packets</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <span className="text-muted-foreground">Rate:</span>
            <span className="font-mono font-semibold text-foreground">{dataRate.toFixed(1)} Hz</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-chart-2" />
            <span className="text-muted-foreground">Last:</span>
            <span className="font-mono text-foreground">{lastPacketTime}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground font-medium">Accelerometer (m/s²)</span>
            <span className="font-mono text-foreground">
              X: {latestData.accel.x.toFixed(3)}, Y: {latestData.accel.y.toFixed(3)}, Z: {latestData.accel.z.toFixed(3)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground font-medium">Gyroscope (rad/s)</span>
            <span className="font-mono text-foreground">
              X: {latestData.gyro.x.toFixed(3)}, Y: {latestData.gyro.y.toFixed(3)}, Z: {latestData.gyro.z.toFixed(3)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground font-medium">Magnetometer (µT)</span>
            <span className="font-mono text-foreground">
              X: {latestData.mag.x.toFixed(3)}, Y: {latestData.mag.y.toFixed(3)}, Z: {latestData.mag.z.toFixed(3)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground font-medium">Quaternion</span>
            <span className="font-mono text-foreground">
              X: {latestData.quat.x.toFixed(2)}, Y: {latestData.quat.y.toFixed(2)}, Z: {latestData.quat.z.toFixed(2)}, W: {latestData.quat.w.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
