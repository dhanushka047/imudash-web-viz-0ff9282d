import { Info } from "lucide-react";

interface StatusBarProps {
  message: string;
}

export const StatusBar = ({ message }: StatusBarProps) => {
  if (!message) return null;
  
  return (
    <div className="bg-primary/10 border-b border-primary/20 px-6 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Info className="w-4 h-4 text-primary" />
        <span className="text-foreground">{message}</span>
      </div>
    </div>
  );
};
