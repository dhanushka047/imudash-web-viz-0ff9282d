import { Button } from "@/components/ui/button";
import { Circle, Download, Radio, Pause, Play, Trash2, Settings } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeaderProps {
  isConnected: boolean;
  isRecording: boolean;
  isPaused: boolean;
  selectedIMU: string;
  onIMUChange: (imu: string) => void;
  onRecord: () => void;
  onExport: () => void;
  onPause: () => void;
  onClear: () => void;
  onSettings: () => void;
  onConnectionClick: () => void;
}

export const Header = ({ isConnected, isRecording, isPaused, selectedIMU, onIMUChange, onRecord, onExport, onPause, onClear, onSettings, onConnectionClick }: HeaderProps) => {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
            <Radio className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">IMU Monitor</h1>
          
          <Select value={selectedIMU} onValueChange={onIMUChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Select IMU" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="imu1">IMU 1</SelectItem>
              <SelectItem value="imu2">IMU 2</SelectItem>
              <SelectItem value="imu3">IMU 3</SelectItem>
              <SelectItem value="imu4">IMU 4</SelectItem>
              <SelectItem value="imu5">IMU 5</SelectItem>
              <SelectItem value="imu6">IMU 6</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant={isRecording ? "destructive" : "default"}
            size="sm"
            onClick={onRecord}
            className="gap-2"
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'fill-current' : ''}`} />
            {isRecording ? 'Stop' : 'Record'}
          </Button>
          
          <Button
            variant={isPaused ? "default" : "outline"}
            size="sm"
            onClick={onPause}
            className="gap-2"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
          
          <Button variant="outline" size="sm" onClick={onClear} className="gap-2">
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
          
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          
          <Button variant="outline" size="sm" onClick={onSettings} className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
          
          <ThemeToggle />
          
          <button
            onClick={onConnectionClick}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-sm font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
