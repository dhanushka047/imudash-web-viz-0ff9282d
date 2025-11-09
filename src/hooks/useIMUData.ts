import { useState, useEffect, useRef } from 'react';

interface IMUData {
  time: number;
  x: number;
  y: number;
  z: number;
}

interface UseIMUDataProps {
  isPaused: boolean;
  onClear?: () => void;
}

const MAX_DATA_POINTS = 50;

const generateSmoothValue = (prev: number, range: number, smoothness: number = 0.1) => {
  const target = prev + (Math.random() - 0.5) * range;
  return prev + (target - prev) * smoothness;
};

export const useIMUData = ({ isPaused }: UseIMUDataProps) => {
  const [accelerometer, setAccelerometer] = useState<IMUData[]>([]);
  const [gyroscope, setGyroscope] = useState<IMUData[]>([]);
  const [magnetometer, setMagnetometer] = useState<IMUData[]>([]);
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  
  const timeRef = useRef(0);
  const prevAccel = useRef({ x: 0, y: 0, z: 9.8 });
  const prevGyro = useRef({ x: 0, y: 0, z: 0 });
  const prevMag = useRef({ x: 25, y: 0, z: 40 });

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused) return;
      
      timeRef.current += 0.1;
      
      // Generate smooth accelerometer data (includes gravity)
      prevAccel.current = {
        x: generateSmoothValue(prevAccel.current.x, 0.5),
        y: generateSmoothValue(prevAccel.current.y, 0.5),
        z: generateSmoothValue(prevAccel.current.z, 0.3) + 9.8
      };
      
      // Generate smooth gyroscope data (angular velocity)
      prevGyro.current = {
        x: generateSmoothValue(prevGyro.current.x, 0.2),
        y: generateSmoothValue(prevGyro.current.y, 0.2),
        z: generateSmoothValue(prevGyro.current.z, 0.2)
      };
      
      // Generate smooth magnetometer data
      prevMag.current = {
        x: generateSmoothValue(prevMag.current.x, 2),
        y: generateSmoothValue(prevMag.current.y, 2),
        z: generateSmoothValue(prevMag.current.z, 2)
      };

      // Update rotation for 3D model
      setRotation(prev => ({
        x: prev.x + prevGyro.current.x * 0.01,
        y: prev.y + prevGyro.current.y * 0.01,
        z: prev.z + prevGyro.current.z * 0.01
      }));

      // Update data arrays
      const updateData = (setData: React.Dispatch<React.SetStateAction<IMUData[]>>, values: { x: number; y: number; z: number }) => {
        setData(prev => {
          const newData = [
            ...prev,
            {
              time: parseFloat(timeRef.current.toFixed(1)),
              ...values
            }
          ].slice(-MAX_DATA_POINTS);
          return newData;
        });
      };

      updateData(setAccelerometer, prevAccel.current);
      updateData(setGyroscope, prevGyro.current);
      updateData(setMagnetometer, prevMag.current);
      
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused]);
  
  const clearData = () => {
    setAccelerometer([]);
    setGyroscope([]);
    setMagnetometer([]);
    timeRef.current = 0;
  };

  return {
    accelerometer,
    gyroscope,
    magnetometer,
    rotation,
    clearData
  };
};
