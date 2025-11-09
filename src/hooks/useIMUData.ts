import { useState, useEffect, useRef } from 'react';

interface IMUData {
  time: number;
  x: number;
  y: number;
  z: number;
}

interface IMUSensorData {
  accelerometer: IMUData[];
  gyroscope: IMUData[];
  magnetometer: IMUData[];
  rotation: { x: number; y: number; z: number };
}

interface UseIMUDataProps {
  isPaused: boolean;
  selectedIMUs: number[];
  onClear?: () => void;
}

const MAX_DATA_POINTS = 50;

const generateSmoothValue = (prev: number, range: number, smoothness: number = 0.1) => {
  const target = prev + (Math.random() - 0.5) * range;
  return prev + (target - prev) * smoothness;
};

export const useIMUData = ({ isPaused, selectedIMUs }: UseIMUDataProps) => {
  const [imuData, setImuData] = useState<Record<number, IMUSensorData>>({
    1: { accelerometer: [], gyroscope: [], magnetometer: [], rotation: { x: 0, y: 0, z: 0 } },
    2: { accelerometer: [], gyroscope: [], magnetometer: [], rotation: { x: 0, y: 0, z: 0 } },
    3: { accelerometer: [], gyroscope: [], magnetometer: [], rotation: { x: 0, y: 0, z: 0 } }
  });
  
  const timeRef = useRef(0);
  const prevData = useRef({
    1: { accel: { x: 0, y: 0, z: 9.8 }, gyro: { x: 0, y: 0, z: 0 }, mag: { x: 25, y: 0, z: 40 } },
    2: { accel: { x: 0, y: 0, z: 9.8 }, gyro: { x: 0, y: 0, z: 0 }, mag: { x: 25, y: 0, z: 40 } },
    3: { accel: { x: 0, y: 0, z: 9.8 }, gyro: { x: 0, y: 0, z: 0 }, mag: { x: 25, y: 0, z: 40 } }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused || selectedIMUs.length === 0) return;
      
      timeRef.current += 0.1;
      
      setImuData(prev => {
        const newData = { ...prev };
        
        selectedIMUs.forEach(imuIndex => {
          const prevImu = prevData.current[imuIndex];
          
          // Generate smooth data for this IMU
          prevImu.accel = {
            x: generateSmoothValue(prevImu.accel.x, 0.5),
            y: generateSmoothValue(prevImu.accel.y, 0.5),
            z: generateSmoothValue(prevImu.accel.z, 0.3) + 9.8
          };
          
          prevImu.gyro = {
            x: generateSmoothValue(prevImu.gyro.x, 0.2),
            y: generateSmoothValue(prevImu.gyro.y, 0.2),
            z: generateSmoothValue(prevImu.gyro.z, 0.2)
          };
          
          prevImu.mag = {
            x: generateSmoothValue(prevImu.mag.x, 2),
            y: generateSmoothValue(prevImu.mag.y, 2),
            z: generateSmoothValue(prevImu.mag.z, 2)
          };

          // Update rotation
          const newRotation = {
            x: newData[imuIndex].rotation.x + prevImu.gyro.x * 0.01,
            y: newData[imuIndex].rotation.y + prevImu.gyro.y * 0.01,
            z: newData[imuIndex].rotation.z + prevImu.gyro.z * 0.01
          };

          // Update data arrays
          const timePoint = parseFloat(timeRef.current.toFixed(1));
          
          newData[imuIndex] = {
            accelerometer: [...newData[imuIndex].accelerometer, { time: timePoint, ...prevImu.accel }].slice(-MAX_DATA_POINTS),
            gyroscope: [...newData[imuIndex].gyroscope, { time: timePoint, ...prevImu.gyro }].slice(-MAX_DATA_POINTS),
            magnetometer: [...newData[imuIndex].magnetometer, { time: timePoint, ...prevImu.mag }].slice(-MAX_DATA_POINTS),
            rotation: newRotation
          };
        });
        
        return newData;
      });
      
    }, 100);

    return () => clearInterval(interval);
  }, [isPaused, selectedIMUs]);
  
  const clearData = () => {
    setImuData({
      1: { accelerometer: [], gyroscope: [], magnetometer: [], rotation: { x: 0, y: 0, z: 0 } },
      2: { accelerometer: [], gyroscope: [], magnetometer: [], rotation: { x: 0, y: 0, z: 0 } },
      3: { accelerometer: [], gyroscope: [], magnetometer: [], rotation: { x: 0, y: 0, z: 0 } }
    });
    timeRef.current = 0;
  };

  return {
    imuData,
    clearData
  };
};
